"use client";

import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { ETAPAS_PIPELINE, LABEL_ETAPA, LABEL_OBJETIVO, LABEL_TIPO, type Etapa } from "@/lib/engine/etapas";
import type { PostEngineResumo } from "@/app/api/maquina/engine/route";
import { Label, LINHA_HOVER, Section, SectionHeader } from "@/components/negocio/panel";

/** Blocos da Máquina de conteúdo. Mesma régua do resto do Command Center: linhas, não cards. */

// ─── HOJE ────────────────────────────────────────────────────────────────────

export function FaixaHoje({ hoje }: { hoje: Record<string, number> }) {
  const itens = [
    { label: "Radar", valor: hoje.fontesEncontradas, sufixo: "encontradas" },
    { label: "Selecionadas", valor: hoje.selecionadas },
    { label: "Em produção", valor: hoje.emProducao },
    { label: "Aguardando aprovação", valor: hoje.aguardandoAprovacao, destaque: true },
    { label: "Agendadas", valor: hoje.agendadas },
    { label: "Publicadas", valor: hoje.publicadas },
  ];

  return (
    <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {itens.map((m, i) => (
          <div
            key={m.label}
            className={[
              "flex min-w-0 flex-col gap-1.5 px-4 py-3",
              i > 0 ? "border-t border-border-subtle sm:border-t-0" : "",
              i >= 3 ? "sm:border-t sm:border-border-subtle lg:border-t-0" : "",
              i % 2 === 1 ? "border-l border-border-subtle sm:border-l-0" : "",
              i % 3 !== 0 ? "sm:border-l sm:border-border-subtle" : "",
              i > 0 ? "lg:border-l lg:border-border-subtle" : "",
            ].join(" ")}
          >
            <Label>{m.label}</Label>
            <span
              className={`text-[24px] font-semibold leading-none tracking-tight tabular-nums ${
                m.valor === 0 ? "text-muted-2" : m.destaque ? "text-[color:var(--warning)]" : "text-foreground"
              }`}
            >
              {m.valor}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Linha de post ───────────────────────────────────────────────────────────

const COR_OBJETIVO: Record<string, string> = {
  ALCANCE: "#4F8CFF",
  AUTORIDADE: "#7C5CFF",
  CONVERSAO: "#22C55E",
};

function situacao(p: PostEngineResumo): { texto: string; tom: "ok" | "aviso" | "erro" | "neutro" } {
  if (p.ultimoErro && ["SELECIONADA", "COPY", "DESIGN", "REVISAO"].includes(p.etapa)) {
    return { texto: `erro: ${p.ultimoErro.slice(0, 60)}`, tom: "erro" };
  }
  switch (p.etapa) {
    case "AGUARDANDO_APROVACAO":
      return { texto: p.scoreFinal !== null ? `pronto · score ${p.scoreFinal}` : "pronto para aprovação", tom: "aviso" };
    case "COPY":
      return { texto: "gerando slides", tom: "neutro" };
    case "DESIGN":
      return { texto: "checando fatos", tom: "neutro" };
    case "REVISAO":
      return { texto: "em revisão", tom: "neutro" };
    case "SELECIONADA":
      return { texto: "escrevendo copy", tom: "neutro" };
    case "AGENDADO":
      return {
        texto: p.agendadoPara ? `agendado ${new Date(p.agendadoPara).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : "agendado",
        tom: "ok",
      };
    case "PUBLICADO":
    case "ANALISE":
      return { texto: "publicado", tom: "ok" };
    default:
      return { texto: LABEL_ETAPA[p.etapa].toLowerCase(), tom: "neutro" };
  }
}

const COR_TOM = { ok: "var(--success)", aviso: "var(--warning)", erro: "var(--danger)", neutro: "var(--muted-2)" };

export function LinhaPost({ p }: { p: PostEngineResumo }) {
  const s = situacao(p);
  return (
    <Link href={`/maquina/engine/${p.id}`} className={`group flex items-center gap-3 py-[7px] ${LINHA_HOVER}`}>
      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: COR_TOM[s.tom] }} />

      {p.capaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.capaUrl} alt="" className="h-9 w-7 shrink-0 rounded-[3px] object-cover" />
      ) : (
        <span className="h-9 w-7 shrink-0 rounded-[3px] border border-border-subtle bg-surface-2" />
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-foreground">{p.tituloInterno ?? "(sem título)"}</span>
        <span className="block truncate text-[11px] text-muted">
          {s.texto}
          {p.slides > 0 && ` · ${p.slidesComImagem}/${p.slides} slides`}
          {p.estilo && ` · ${p.estilo}`}
        </span>
      </span>

      {p.objetivo && (
        <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.08em] sm:inline" style={{ color: COR_OBJETIVO[p.objetivo] ?? "var(--muted-2)" }}>
          {LABEL_OBJETIVO[p.objetivo as keyof typeof LABEL_OBJETIVO] ?? p.objetivo}
        </span>
      )}
      {p.tipoConteudo && (
        <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.08em] text-muted-2 md:inline">
          {LABEL_TIPO[p.tipoConteudo as keyof typeof LABEL_TIPO] ?? p.tipoConteudo}
        </span>
      )}

      <ArrowRight className="h-3 w-3 shrink-0 text-muted-2 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export function PipelineFaixa({ porEtapa }: { porEtapa: Record<string, number> }) {
  return (
    <Section>
      <SectionHeader titulo="Pipeline" />
      <div className="-mx-2 flex items-stretch gap-1 overflow-x-auto px-2 py-2">
        {ETAPAS_PIPELINE.map((e, i) => {
          const n = porEtapa[e] ?? 0;
          return (
            <div key={e} className="flex items-center gap-1">
              <div
                className={`flex min-w-[92px] flex-col rounded-[8px] border px-2.5 py-1.5 ${
                  n > 0 ? "border-border bg-surface-2/60" : "border-border-subtle/60"
                }`}
              >
                <span className="text-[9px] uppercase tracking-[0.09em] text-muted-2">{LABEL_ETAPA[e as Etapa]}</span>
                <span className={`text-[16px] font-semibold tabular-nums ${n > 0 ? "text-foreground" : "text-muted-2"}`}>{n}</span>
              </div>
              {i < ETAPAS_PIPELINE.length - 1 && <span className="text-[10px] text-muted-2">›</span>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Prontidão ───────────────────────────────────────────────────────────────

export function Prontidao({ pronto, execucoes, modo }: { pronto: { ia: boolean; blob: boolean; instagram: boolean }; execucoes: { usadas: number; teto: number }; modo: string }) {
  const itens = [
    { ok: pronto.ia, label: "IA", dica: "AI_GATEWAY_API_KEY" },
    { ok: pronto.blob, label: "Storage", dica: "BLOB_READ_WRITE_TOKEN" },
    { ok: pronto.instagram, label: "Instagram", dica: "IG_ACCESS_TOKEN" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span>
        modo <span className="font-medium text-foreground-2">{modo}</span>
      </span>
      <span>
        execuções hoje <span className="tabular-nums text-foreground-2">{execucoes.usadas}/{execucoes.teto}</span>
      </span>
      {itens.map((i) => (
        <span key={i.label} className="flex items-center gap-1" title={i.ok ? "configurado" : `falta ${i.dica}`}>
          {i.ok ? <Check className="h-3 w-3 text-[color:var(--success)]" /> : <span className="h-[6px] w-[6px] rounded-full bg-[color:var(--danger)]" />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[12px] text-muted">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {texto}
    </div>
  );
}
