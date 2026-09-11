"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Play, Radar, Settings2 } from "lucide-react";
import type { EngineOverview } from "@/app/api/maquina/engine/route";
import { ETAPAS_EM_PRODUCAO } from "@/lib/engine/etapas";
import { EmptyLine, Section, SectionHeader } from "@/components/negocio/panel";
import { Carregando, FaixaHoje, LinhaPost, PipelineFaixa, Prontidao } from "@/components/engine/blocos";

/**
 * Máquina de conteúdo — a visão operacional.
 *
 * Os 11 agentes trabalham atrás. Aqui você vê o dia, a fila de aprovação e o
 * que está rodando. A área avançada (execuções, prompts, fontes) fica em /avancado.
 */
export default function EnginePage() {
  const [dados, setDados] = useState<EngineOverview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((n) => n + 1), []);

  const [rodando, setRodando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [radarAberto, setRadarAberto] = useState(false);
  const [urls, setUrls] = useState("");
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/maquina/engine")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((j: EngineOverview) => {
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
  }, [versao]);

  async function rodar(acao: "dia" | "producao") {
    setRodando(acao);
    setAviso(null);
    try {
      const r = await fetch("/api/maquina/engine/rodar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const j = await r.json();
      if (!r.ok) {
        setAviso(j.error ?? "Falhou.");
        return;
      }
      const partes: string[] = [];
      if (typeof j.criados === "number") partes.push(`${j.criados} selecionado(s)`);
      if (typeof j.avancados === "number") partes.push(`${j.avancados} avançado(s)`);
      if (j.falhas?.length) partes.push(`${j.falhas.length} falha(s): ${j.falhas[0]}`);
      setAviso(partes.join(" · ") || "Nada a fazer agora.");
      recarregar();
    } catch {
      setAviso("Erro de conexão.");
    } finally {
      setRodando(null);
    }
  }

  async function alimentarRadar() {
    const lista = urls.split(/\s+/).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
    if (!lista.length && !tema.trim()) return;
    setRodando("radar");
    setAviso(null);
    try {
      const r = await fetch("/api/maquina/engine/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: lista, tema: tema.trim() || undefined, contexto: contexto.trim() || undefined }),
      });
      const j = await r.json();
      const ok = (j.resultados ?? []).filter((x: { ok: boolean }) => x.ok).length;
      const falhas = (j.resultados ?? []).filter((x: { ok: boolean }) => !x.ok);
      setAviso(
        `${ok} fonte(s) lida(s)${j.temaId ? " + 1 tema" : ""}${falhas.length ? ` · ${falhas.length} falhou: ${falhas[0].erro}` : ""}`
      );
      setUrls("");
      setTema("");
      setContexto("");
      setRadarAberto(false);
      recarregar();
    } catch {
      setAviso("Erro de conexão.");
    } finally {
      setRodando(null);
    }
  }

  const fila = dados?.posts.filter((p) => p.etapa === "AGUARDANDO_APROVACAO") ?? [];
  const producao = dados?.posts.filter((p) => (ETAPAS_EM_PRODUCAO as string[]).includes(p.etapa)) ?? [];
  const agendados = dados?.posts.filter((p) => p.etapa === "AGENDADO") ?? [];
  const btn =
    "inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:bg-surface-2 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50";

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Máquina de conteúdo</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {dados
              ? dados.hoje.aguardandoAprovacao > 0
                ? `${dados.hoje.aguardandoAprovacao} post${dados.hoje.aguardandoAprovacao > 1 ? "s" : ""} aguardando sua aprovação.`
                : producao.length > 0
                  ? `${producao.length} em produção. Nada para aprovar ainda.`
                  : "Nada em produção. Alimente o Radar ou rode o dia."
              : "A IA pesquisa, escreve, desenha e revisa. Você aprova."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button className={btn} onClick={() => setRadarAberto((v) => !v)} disabled={!!rodando}>
            <Radar className="h-3.5 w-3.5" /> Radar
          </button>
          <button className={btn} onClick={() => rodar("dia")} disabled={!!rodando} title="Estrategista seleciona + produção avança">
            {rodando === "dia" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Rodar o dia
          </button>
          <Link href="/maquina/engine/avancado" className={btn} title="Agentes, execuções, prompts, fontes, aprendizados">
            <Settings2 className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {dados && <Prontidao pronto={dados.pronto} execucoes={dados.execucoes} modo={dados.modo} />}

      {aviso && (
        <div className="flex items-center gap-2 rounded-[10px] border border-border-subtle bg-surface/50 px-3 py-2 text-[12px] text-foreground-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted" /> {aviso}
        </div>
      )}

      {radarAberto && (
        <div className="space-y-2 rounded-[10px] border border-border bg-surface/60 p-3">
          <p className="text-[12px] font-semibold text-foreground">Alimentar o Radar</p>
          <p className="text-[11px] text-muted">
            Cole links de carrosséis, artigos, threads ou vídeos que performaram. O Radar lê a página e descreve por que pode funcionar para você. Ou registre um tema seu.
          </p>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            rows={3}
            placeholder={"https://…\nhttps://…"}
            className="w-full rounded-[8px] border border-border bg-surface-2 px-2.5 py-2 font-mono text-[12px] outline-none placeholder:text-muted-2 focus:border-brand/50"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Tema seu (opcional): ex. 'automatizei a cobrança de um cliente'"
              className="rounded-[8px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-muted-2 focus:border-brand/50"
            />
            <input
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Contexto em uma frase"
              className="rounded-[8px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-muted-2 focus:border-brand/50"
            />
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={alimentarRadar} disabled={!!rodando}>
              {rodando === "radar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />} Ler fontes
            </button>
            <button className="text-[12px] text-muted hover:text-foreground" onClick={() => setRadarAberto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {carregando && <Carregando texto="Lendo a máquina…" />}

      {!carregando && erro && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-4 py-3 text-[13px] text-[color:var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" /> Não foi possível carregar a máquina.
        </div>
      )}

      {!carregando && !erro && dados && (
        <>
          <FaixaHoje hoje={dados.hoje} />

          <Section>
            <SectionHeader titulo="Aguardando sua aprovação" meta={fila.length ? `${fila.length}` : undefined} />
            {fila.length === 0 ? (
              <EmptyLine titulo="Fila vazia" descricao="Quando um post passar pela revisão, ele aparece aqui." />
            ) : (
              <div className="divide-y divide-border-subtle/70">
                {fila.map((p) => (
                  <LinhaPost key={p.id} p={p} />
                ))}
              </div>
            )}
          </Section>

          <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 xl:grid-cols-2">
            <Section>
              <SectionHeader
                titulo="Em produção"
                meta={producao.length ? `${producao.length}` : undefined}
                href={producao.length ? undefined : undefined}
              />
              {producao.length === 0 ? (
                <EmptyLine titulo="Nada rodando" descricao="Rode o dia para o Estrategista selecionar ideias." />
              ) : (
                <>
                  <div className="divide-y divide-border-subtle/70">
                    {producao.map((p) => (
                      <LinhaPost key={p.id} p={p} />
                    ))}
                  </div>
                  <button className={`${btn} mt-2`} onClick={() => rodar("producao")} disabled={!!rodando}>
                    {rodando === "producao" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Avançar produção
                  </button>
                </>
              )}
            </Section>

            <Section>
              <SectionHeader titulo="Agendados" meta={agendados.length ? `${agendados.length}` : undefined} href="/maquina/calendario" hrefLabel="Calendário" />
              {agendados.length === 0 ? (
                <EmptyLine titulo="Nenhum agendado" descricao="Aprovar um post o coloca no calendário." />
              ) : (
                <div className="divide-y divide-border-subtle/70">
                  {agendados.map((p) => (
                    <LinhaPost key={p.id} p={p} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          <PipelineFaixa porEtapa={dados.porEtapa} />
        </>
      )}
    </div>
  );
}
