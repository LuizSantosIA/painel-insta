"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Check, Loader2, RefreshCw, X } from "lucide-react";
import type { PostEngineDetalhe } from "@/app/api/maquina/engine/[id]/route";
import { LABEL_ETAPA, LABEL_OBJETIVO, LABEL_TIPO, type Etapa } from "@/lib/engine/etapas";
import { Label, Section, SectionHeader } from "@/components/negocio/panel";
import { Carregando } from "@/components/engine/blocos";

/**
 * Tela do post. Tudo o que você precisa para decidir em segundos:
 * ideia → roteiro → visual → legenda → CTA → checklist → APROVAR / ALTERAR / REPROVAR.
 */

const btn =
  "inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50";
const btnNeutro = `${btn} border-border bg-surface-2/70 text-foreground-2 hover:border-brand/35 hover:text-foreground`;
const input =
  "w-full rounded-[8px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-muted-2 focus:border-brand/50";

function Marca({ ok }: { ok: boolean | "ALERTA" | "PENDENTE" }) {
  if (ok === true) return <Check className="h-3.5 w-3.5 text-[color:var(--success)]" />;
  if (ok === "ALERTA" || ok === "PENDENTE") return <AlertCircle className="h-3.5 w-3.5 text-[color:var(--warning)]" />;
  return <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-border" />;
}

export default function PostEnginePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [d, setD] = useState<PostEngineDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((n) => n + 1), []);

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // edição local
  const [slides, setSlides] = useState<PostEngineDetalhe["slides"]>([]);
  const [legenda, setLegenda] = useState("");
  const [palavra, setPalavra] = useState("");
  const [sujo, setSujo] = useState(false);

  // decisão
  const [modoDecisao, setModoDecisao] = useState<"ALTERACAO" | "REPROVADO" | null>(null);
  const [escopo, setEscopo] = useState("POST");
  const [motivo, setMotivo] = useState("");
  const [agendarPara, setAgendarPara] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch(`/api/maquina/engine/${id}`)
      .then(async (r) => {
        if (!ativo) return;
        if (!r.ok) {
          setErro(r.status === 404 ? "Post não encontrado." : "Não foi possível carregar.");
          return;
        }
        const j: PostEngineDetalhe = await r.json();
        setD(j);
        setSlides(j.slides);
        setLegenda(j.legendaFinal ?? "");
        setPalavra(j.palavraChave ?? "");
        setSujo(false);
        setErro(null);
      })
      .catch(() => {
        if (ativo) setErro("Erro de conexão.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [id, versao]);

  async function chamar(rota: string, body?: unknown, rotulo = rota) {
    setOcupado(rotulo);
    setAviso(null);
    try {
      const r = await fetch(`/api/maquina/engine/${id}${rota}`, {
        method: rota === "" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setAviso(j.error ?? j.erro ?? "Falhou.");
      else if (j.detalhe) setAviso(j.detalhe);
      recarregar();
      return r.ok;
    } catch {
      setAviso("Erro de conexão.");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function salvarEdicoes() {
    const ok = await chamar("", { slides: slides.map((s) => ({ ordem: s.ordem, headline: s.headline, corpo: s.corpo, microcopy: s.microcopy })), legendaFinal: legenda, palavraChave: palavra || null }, "salvar");
    if (ok) setAviso("Salvo. Slides editados precisam ser regenerados.");
  }

  async function decidir(decisao: "APROVADO" | "ALTERACAO" | "REPROVADO") {
    const ok = await chamar(
      "/revisar",
      { decisao, escopo: decisao === "APROVADO" ? "POST" : escopo, motivo, agendarPara: agendarPara ? new Date(agendarPara).toISOString() : null },
      decisao
    );
    if (ok) {
      setModoDecisao(null);
      setMotivo("");
    }
  }

  if (carregando) return <Carregando texto="Abrindo o post…" />;
  if (erro || !d) {
    return (
      <div className="space-y-4">
        <Link href="/maquina/engine" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Máquina
        </Link>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" /> {erro}
        </div>
      </div>
    );
  }

  const aguardando = d.etapa === "AGUARDANDO_APROVACAO";
  const verificacoes = ((d.factCheck as { verificacoes?: { afirmacao: string; status: string; nota: string }[] } | null)?.verificacoes ?? []).filter(
    (v) => v.status !== "VERIFICADO"
  );
  const emProducao = ["SELECIONADA", "COPY", "DESIGN", "REVISAO"].includes(d.etapa ?? "");
  const score = d.scoreEstrategia;

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/maquina/engine" className="group inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" /> Máquina
      </Link>

      {/* ── Cabeçalho ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold leading-tight tracking-tight">{d.tituloInterno ?? "(sem título)"}</h1>
            <span className="rounded-md border border-border px-1.5 py-[1px] text-[11px] text-muted">{d.etapa ? LABEL_ETAPA[d.etapa as Etapa] : "—"}</span>
            {d.scoreFinal !== null && (
              <span className={`text-[11px] font-medium ${d.scoreFinal >= 70 ? "text-[color:var(--success)]" : "text-[color:var(--warning)]"}`}>score {d.scoreFinal}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-2">
            {d.tipoConteudo && <span>{LABEL_TIPO[d.tipoConteudo as keyof typeof LABEL_TIPO] ?? d.tipoConteudo}</span>}
            {d.objetivo && <span>{LABEL_OBJETIVO[d.objetivo as keyof typeof LABEL_OBJETIVO] ?? d.objetivo}</span>}
            {d.tema && <span>{d.tema}</span>}
            {d.estilo && <span>{d.estilo.nome}</span>}
            {d.fonte && (
              <a href={d.fonte.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                fonte: {d.fonte.autor ?? d.fonte.titulo ?? d.fonte.plataforma ?? "link"} ↗
              </a>
            )}
          </div>
          {score && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-muted">
              {(["viralidade", "fit", "producao", "valor", "conversao"] as const).map((k) => (
                <span key={k}>
                  {k} <span className="text-foreground-2">{score[k]}</span>
                </span>
              ))}
              {typeof score.angulo === "string" && <span className="basis-full text-muted-2">ângulo: {score.angulo}</span>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {emProducao && (
            <button className={btnNeutro} onClick={() => chamar("/avancar", undefined, "avancar")} disabled={!!ocupado}>
              {ocupado === "avancar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Avançar etapa
            </button>
          )}
          {d.etapa === "AGENDADO" && (
            <button className={btnNeutro} onClick={() => chamar("/publicar", undefined, "publicar")} disabled={!!ocupado}>
              {ocupado === "publicar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Publicar agora
            </button>
          )}
          {sujo && (
            <button className={btnNeutro} onClick={salvarEdicoes} disabled={!!ocupado}>
              {ocupado === "salvar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Salvar edições
            </button>
          )}
        </div>
      </header>

      {aviso && (
        <div className="flex items-center gap-2 rounded-[10px] border border-border-subtle bg-surface/50 px-3 py-2 text-[12px] text-foreground-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted" /> {aviso}
        </div>
      )}

      {d.revisorResumo && (
        <p className="rounded-[10px] border border-border-subtle bg-surface/40 px-3 py-2 text-[12px] text-foreground-2">
          <span className="text-muted-2">Revisor: </span>
          {d.revisorResumo}
        </p>
      )}

      {/* ── Visual ── */}
      <Section>
        <SectionHeader titulo="Visual" meta={`${d.slides.filter((s) => s.imagemUrl).length}/${d.slides.length} slides`} />
        {d.slides.length === 0 ? (
          <p className="py-2.5 text-[12px] text-muted">Sem slides ainda — o Copywriter roda na próxima etapa.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-3 lg:grid-cols-4">
            {d.slides.map((s) => (
              <div key={s.id} className="space-y-1.5">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[8px] border border-border-subtle bg-surface-2">
                  {s.imagemUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imagemUrl} alt={`Slide ${s.ordem}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
                      <span className="text-[11px] text-muted-2">sem imagem</span>
                      <span className="line-clamp-3 text-[11px] text-muted">{s.headline}</span>
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-[1px] text-[10px] tabular-nums text-white">
                    {s.ordem} · {s.layout.toLowerCase()} · v{s.versao}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    className="flex-1 rounded-[6px] border border-border px-1.5 py-1 text-[10px] text-muted transition-colors hover:text-foreground disabled:opacity-50"
                    onClick={() => chamar("/slides", { ordens: [s.ordem] }, `slide${s.ordem}`)}
                    disabled={!!ocupado}
                    title="Renderiza de novo com o texto e a direção atuais"
                  >
                    {ocupado === `slide${s.ordem}` ? "…" : "Regenerar"}
                  </button>
                  <button
                    className="flex-1 rounded-[6px] border border-border px-1.5 py-1 text-[10px] text-muted transition-colors hover:text-foreground disabled:opacity-50"
                    onClick={() => chamar("/slides", { ordens: [s.ordem], redirigir: true }, `redir${s.ordem}`)}
                    disabled={!!ocupado}
                    title="Diretor Visual refaz a direção deste slide e renderiza"
                  >
                    {ocupado === `redir${s.ordem}` ? "…" : "Nova direção"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {d.estilosDisponiveis.length > 1 && (
          <div className="flex items-center gap-2 border-t border-border-subtle/70 pt-2 text-[11px] text-muted">
            <span>Sistema visual</span>
            <select
              className="rounded-[6px] border border-border bg-surface-2 px-2 py-1 text-[11px] text-foreground-2 outline-none"
              value={d.estilo?.id ?? ""}
              onChange={async (e) => {
                await chamar("", { estiloVisualId: e.target.value }, "estilo");
                await chamar("/slides", { redirigir: true }, "redirigir-tudo");
              }}
              disabled={!!ocupado}
            >
              {d.estilosDisponiveis.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <span className="text-muted-2">trocar refaz a direção de todos os slides</span>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 xl:grid-cols-[1.4fr_1fr]">
        {/* ── Roteiro ── */}
        <Section>
          <SectionHeader titulo="Roteiro" meta="editável" />
          <div className="divide-y divide-border-subtle/70">
            {slides.map((s, i) => (
              <div key={s.id} className="space-y-1 py-2">
                <Label>
                  slide {s.ordem} · {s.layout.toLowerCase()}
                </Label>
                <input
                  className={`${input} font-medium text-foreground`}
                  value={s.headline}
                  onChange={(e) => {
                    const c = [...slides];
                    c[i] = { ...s, headline: e.target.value };
                    setSlides(c);
                    setSujo(true);
                  }}
                />
                <textarea
                  className={input}
                  rows={2}
                  value={s.corpo}
                  onChange={(e) => {
                    const c = [...slides];
                    c[i] = { ...s, corpo: e.target.value };
                    setSlides(c);
                    setSujo(true);
                  }}
                />
                {s.promptVisual && <p className="text-[11px] text-muted-2">direção: {s.promptVisual}</p>}
              </div>
            ))}
          </div>
        </Section>

        <div className="space-y-6">
          {/* ── Legenda ── */}
          <Section>
            <SectionHeader titulo="Legenda" />
            <textarea
              className={`${input} mt-2`}
              rows={7}
              value={legenda}
              onChange={(e) => {
                setLegenda(e.target.value);
                setSujo(true);
              }}
              placeholder="A legenda aparece depois da copy."
            />
          </Section>

          {/* ── CTA ── */}
          <Section>
            <SectionHeader titulo="CTA" />
            <div className="space-y-1.5 py-2 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="w-16 text-muted-2">Palavra</span>
                <input
                  className={`${input} uppercase`}
                  value={palavra}
                  onChange={(e) => {
                    setPalavra(e.target.value.toUpperCase());
                    setSujo(true);
                  }}
                  placeholder="sem palavra-chave"
                />
              </div>
              {d.leadMagnet && d.leadMagnet.status !== "SEM_CTA" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-muted-2">Destino</span>
                    <span className="truncate text-foreground-2">{d.leadMagnet.destino || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-muted-2">Material</span>
                    <span className={d.leadMagnet.status === "PRONTO" ? "text-[color:var(--success)]" : "text-[color:var(--warning)]"}>
                      {d.leadMagnet.status === "PRONTO" ? "Pronto" : "Material pendente"}
                    </span>
                    {d.leadMagnet.regraId && (
                      <Link href="/maquina/automacoes" className="text-[11px] text-brand hover:underline">
                        automação →
                      </Link>
                    )}
                  </div>
                  {d.leadMagnet.status === "PENDENTE" && d.leadMagnet.proposta ? (
                    <p className="rounded-[8px] bg-surface-2/60 p-2 text-[11px] text-muted">
                      <span className="text-foreground-2">Proposta do Lead Magnet: </span>
                      {String((d.leadMagnet.proposta as { propostaMaterial?: string }).propostaMaterial ?? "")}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </Section>

          {/* ── Checklist ── */}
          <Section>
            <SectionHeader titulo="Checklist" />
            <div className="divide-y divide-border-subtle/70 text-[12px]">
              {(
                [
                  ["Copy", d.checklist.copy],
                  ["Design", d.checklist.design],
                  ["Fact-check", d.checklist.factCheck],
                  ["Lead magnet", d.checklist.leadMagnet],
                  ["Legenda", d.checklist.legenda],
                ] as const
              ).map(([rotulo, ok]) => (
                <div key={rotulo} className="flex items-center gap-2 py-[6px]">
                  <Marca ok={ok} />
                  <span className="text-foreground-2">{rotulo}</span>
                  {ok === "ALERTA" && <span className="text-[11px] text-[color:var(--warning)]">com alertas</span>}
                  {ok === "PENDENTE" && <span className="text-[11px] text-[color:var(--warning)]">material pendente</span>}
                </div>
              ))}
            </div>
            {verificacoes.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border-subtle/70 pt-2">
                {verificacoes.map((v, i) => (
                    <p key={i} className="text-[11px] text-muted">
                      <span className={v.status === "INCORRETO" ? "text-[color:var(--danger)]" : "text-[color:var(--warning)]"}>{v.status.replace("_", " ").toLowerCase()}</span>
                      {" · "}
                      {v.afirmacao} — {v.nota}
                    </p>
                  ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Ações ── */}
      {(aguardando || d.etapa === "REPROVADO") && (
        <Section>
          <SectionHeader titulo="Decisão" />
          {modoDecisao === null ? (
            <div className="flex flex-wrap items-center gap-2 py-3">
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <span>Agendar para</span>
                <input type="datetime-local" className="rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-foreground-2 outline-none" value={agendarPara} onChange={(e) => setAgendarPara(e.target.value)} />
              </div>
              <button className={`${btn} border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-foreground hover:bg-[color:var(--success)]/20`} onClick={() => decidir("APROVADO")} disabled={!!ocupado || sujo}>
                {ocupado === "APROVADO" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar
              </button>
              <button className={btnNeutro} onClick={() => setModoDecisao("ALTERACAO")} disabled={!!ocupado}>
                Pedir alteração
              </button>
              <button className={`${btn} border-[color:var(--danger)]/30 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10`} onClick={() => setModoDecisao("REPROVADO")} disabled={!!ocupado}>
                <X className="h-3.5 w-3.5" /> Reprovar
              </button>
              {sujo && <span className="text-[11px] text-[color:var(--warning)]">salve as edições antes de aprovar</span>}
            </div>
          ) : (
            <div className="space-y-2 py-3">
              {modoDecisao === "ALTERACAO" && (
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-muted-2">O que mudar</span>
                  <select className="rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-foreground-2 outline-none" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
                    <option value="POST">Post inteiro</option>
                    <option value="COPY">Copy (texto)</option>
                    <option value="VISUAL">Visual (todos os slides)</option>
                    <option value="LEGENDA">Legenda</option>
                    {d.slides.map((s) => (
                      <option key={s.ordem} value={`SLIDE:${s.ordem}`}>
                        Só o slide {s.ordem}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-muted-2">só a parte escolhida volta ao pipeline</span>
                </div>
              )}
              <textarea
                className={input}
                rows={2}
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={modoDecisao === "ALTERACAO" ? "Ex.: hook fraco, texto demais no slide 3, paleta genérica…" : "Por que não serve? Vira aprendizado para as próximas."}
              />
              <div className="flex gap-2">
                <button className={btnNeutro} onClick={() => decidir(modoDecisao)} disabled={!!ocupado || !motivo.trim()}>
                  {ocupado === modoDecisao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {modoDecisao === "ALTERACAO" ? "Enviar para alteração" : "Confirmar reprovação"}
                </button>
                <button className="text-[12px] text-muted hover:text-foreground" onClick={() => setModoDecisao(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Trilha ── */}
      {(d.revisoes.length > 0 || d.execucoes.length > 0) && (
        <Section>
          <SectionHeader titulo="Trilha" meta={`${d.execucoes.length} execuções`} href="/maquina/engine/avancado" hrefLabel="Área avançada" />
          <div className="divide-y divide-border-subtle/70">
            {d.revisoes.map((r) => (
              <div key={r.id} className="flex items-baseline gap-2 py-[6px] text-[12px]">
                <span className={`shrink-0 font-medium ${r.decisao === "APROVADO" ? "text-[color:var(--success)]" : r.decisao === "REPROVADO" ? "text-[color:var(--danger)]" : "text-[color:var(--warning)]"}`}>{r.decisao.toLowerCase()}</span>
                <span className="text-muted-2">{r.escopo.toLowerCase()}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.motivo}</span>
                <span className="shrink-0 text-[11px] text-muted-2">{new Date(r.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
            {d.execucoes.slice(0, 12).map((e) => (
              <div key={e.id} className="flex items-baseline gap-2 py-[6px] text-[12px]">
                <span className={`h-[6px] w-[6px] shrink-0 translate-y-[-1px] rounded-full ${e.status === "ERRO" ? "bg-[color:var(--danger)]" : e.status === "ALERTA" ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`} />
                <span className="shrink-0 text-foreground-2">{e.agente.toLowerCase().replace("_", " ")}</span>
                {e.slideOrdem !== null && <span className="text-muted-2">slide {e.slideOrdem}</span>}
                <span className="min-w-0 flex-1 truncate text-muted">{e.erro ?? (e.modelo !== "—" ? `${e.modelo} · ${e.tokensIn + e.tokensOut} tokens` : "")}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-2">{(e.duracaoMs / 1000).toFixed(1)}s</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
