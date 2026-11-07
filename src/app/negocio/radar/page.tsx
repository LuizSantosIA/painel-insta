"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Play, RefreshCw, Search } from "lucide-react";
import type { RadarOverview } from "@/app/api/radar/route";
import { EmptyLine, Label, LINHA_HOVER, Section, SectionHeader } from "@/components/negocio/panel";

/**
 * Prospecção — a lista crua da Fase 1.
 *
 * Score, sinais e mensagens entram nas fases seguintes; por ora a tela mostra
 * o que a busca trouxe e o que foi descartado, que é o que precisa ser
 * conferido antes de confiar no filtro.
 */

const LABEL_VERTICAL: Record<string, string> = {
  REVENDA: "Revenda",
  CLINICA: "Clínica",
  IMOBILIARIA: "Imobiliária",
};

const LABEL_DESCARTE: Record<string, string> = {
  OPT_OUT: "pediu para não contatar",
  BLOQUEADO: "bloqueado",
  REDE_NACIONAL: "rede nacional",
  POUCAS_AVALIACOES: "poucas avaliações",
  JA_NO_PIPELINE: "já no pipeline",
  DUPLICADO: "repetido",
  SEM_CONTATO: "sem telefone",
};

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function RadarPage() {
  const [dados, setDados] = useState<RadarOverview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((n) => n + 1), []);

  const [vertical, setVertical] = useState("");
  const [status, setStatus] = useState("");
  const [rodando, setRodando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const q = new URLSearchParams();
    if (vertical) q.set("vertical", vertical);
    if (status) q.set("status", status);

    fetch(`/api/radar?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((j: RadarOverview) => {
        if (ativo) {
          setDados(j);
          setErro(false);
        }
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [versao, vertical, status]);

  async function rodarAgora() {
    setRodando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/radar/rodar", { method: "POST", headers: { "Content-Type": "application/json" } });
      const j = await r.json();
      setAviso(
        r.ok
          ? `Busca iniciada em ${j.alvos} alvo(s). O Apify leva alguns minutos; a lista aparece quando terminar.`
          : (j.erro ?? j.error ?? "Não foi possível iniciar.")
      );
      recarregar();
    } catch {
      setAviso("Erro de conexão.");
    } finally {
      setRodando(false);
    }
  }

  async function coletarAgora() {
    if (!dados?.ultimaExecucao) return;
    setRodando(true);
    try {
      const r = await fetch(`/api/radar/coletar?execucao=${dados.ultimaExecucao.id}`, { method: "POST" });
      const j = await r.json();
      setAviso(
        j.status === "RODANDO"
          ? "O Apify ainda está rodando. Tente de novo em um minuto."
          : `${j.status}: ${j.novos} novo(s), ${j.descartados} descartado(s), custo ${reais(j.custoCentavos ?? 0)}.`
      );
      recarregar();
    } catch {
      setAviso("Erro ao coletar.");
    } finally {
      setRodando(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground disabled:opacity-50";
  const sel =
    "rounded-[8px] border border-border bg-surface-2 px-2 py-1 text-[12px] text-foreground-2 outline-none focus:border-brand/50";

  const ex = dados?.ultimaExecucao;

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Prospecção</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {dados
              ? `${dados.total} ${dados.total === 1 ? "empresa encontrada" : "empresas encontradas"} · nenhuma mensagem é enviada automaticamente`
              : "Empresas qualificadas de fonte pública. Você aperta o botão de enviar."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ex?.status === "RODANDO" && (
            <button className={btn} onClick={coletarAgora} disabled={rodando}>
              {rodando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Buscar resultado
            </button>
          )}
          <button className={btn} onClick={rodarAgora} disabled={rodando || !dados?.pronto.apify}>
            {rodando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Rodar agora
          </button>
        </div>
      </header>

      {dados && !dados.pronto.apify && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[color:var(--warning)]/25 bg-[color:var(--warning)]/8 px-3 py-2 text-[12px] text-[color:var(--warning)]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Falta APIFY_TOKEN. Sem ele a busca não roda.
        </div>
      )}

      {aviso && (
        <div className="flex items-start gap-2 rounded-[10px] border border-border-subtle bg-surface/50 px-3 py-2 text-[12px] text-foreground-2">
          <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0 text-muted" /> {aviso}
        </div>
      )}

      {ex && (
        <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
          <div className="grid grid-cols-2 sm:grid-cols-5">
            {[
              { label: "Última rodada", valor: ex.status, texto: true },
              { label: "Encontradas", valor: String(ex.encontrados) },
              { label: "Novas", valor: String(ex.novos), destaque: true },
              { label: "Descartadas", valor: String(ex.descartados) },
              { label: "Custo", valor: reais(ex.custoCentavos), texto: true },
            ].map((m, i) => (
              <div
                key={m.label}
                className={`flex min-w-0 flex-col gap-1.5 px-4 py-3 ${i > 0 ? "border-t border-border-subtle sm:border-l sm:border-t-0" : ""}`}
              >
                <Label>{m.label}</Label>
                <span
                  className={`${m.texto ? "text-[13px]" : "text-[22px]"} font-semibold leading-none tracking-tight tabular-nums ${
                    m.destaque ? "text-[color:var(--success)]" : "text-foreground"
                  }`}
                >
                  {m.valor}
                </span>
              </div>
            ))}
          </div>
          {(Object.keys(ex.descartes).length > 0 || ex.erro) && (
            <div className="border-t border-border-subtle px-4 py-2 text-[11px] text-muted">
              {ex.erro && <span className="text-[color:var(--danger)]">{ex.erro} · </span>}
              {Object.entries(ex.descartes)
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([k, n]) => `${n} ${LABEL_DESCARTE[k] ?? k}`)
                .join(" · ")}
              {ex.terminadoEm && ` · terminou ${hora(ex.terminadoEm)}`}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={vertical} onChange={(e) => setVertical(e.target.value)}>
          <option value="">Todas as verticais</option>
          {Object.keys(dados?.porVertical ?? {}).map((v) => (
            <option key={v} value={v}>
              {LABEL_VERTICAL[v] ?? v} ({dados?.porVertical[v]})
            </option>
          ))}
        </select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.keys(dados?.porStatus ?? {}).map((s) => (
            <option key={s} value={s}>
              {s} ({dados?.porStatus[s]})
            </option>
          ))}
        </select>
      </div>

      {carregando && (
        <div className="flex items-center gap-2 py-6 text-[12px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" /> Não foi possível carregar a prospecção.
        </div>
      )}

      {!carregando && !erro && dados && (
        <Section>
          <SectionHeader titulo="Empresas" meta={dados.prospects.length ? `${dados.prospects.length}` : undefined} />
          {dados.prospects.length === 0 ? (
            <EmptyLine
              titulo="Nenhuma empresa ainda"
              descricao={dados.pronto.apify ? "Clique em Rodar agora para a primeira busca." : "Configure APIFY_TOKEN e rode a busca."}
            />
          ) : (
            <div className="divide-y divide-border-subtle/70">
              {dados.prospects.map((p) => (
                <div key={p.id} className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-[7px] text-[12px] ${LINHA_HOVER}`}>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{p.nome}</span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-2">
                    {LABEL_VERTICAL[p.vertical] ?? p.vertical}
                  </span>
                  <span className="shrink-0 text-muted">
                    {p.bairro ? `${p.bairro}, ` : ""}
                    {p.cidade}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {p.notaMaps ? `★ ${p.notaMaps.toFixed(1)}` : "—"} · {p.totalAvaliacoes} aval.
                  </span>
                  <span
                    className={`shrink-0 text-[11px] ${p.tipoTelefone === "CELULAR" ? "text-[color:var(--success)]" : "text-muted-2"}`}
                  >
                    {p.tipoTelefone === "CELULAR" ? "WhatsApp provável" : p.tipoTelefone === "FIXO" ? "ligar primeiro" : "sem telefone"}
                  </span>
                  {p.status !== "NOVO" && <span className="shrink-0 text-[11px] text-muted-2">{p.status}</span>}
                  {p.site && (
                    <a
                      href={p.site}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[11px] text-muted hover:text-foreground"
                    >
                      site
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-2">
        <Search className="h-3 w-3" /> Fase 1: busca, deduplicação e exclusões. Score, sinais e mensagens vêm nas próximas.
      </p>
    </div>
  );
}
