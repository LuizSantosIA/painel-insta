"use client";

import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import {
  LABEL_FONTE,
  type ItemAgenda,
  type ItemAtencao,
  type ItemProximo,
  type TarefaDoDia,
} from "@/lib/hoje";
import type { Severidade } from "@/lib/negocio-overview";

/**
 * Blocos da tela Hoje.
 *
 * Tudo é linha, não card: a tela é uma fila de decisões, e cada linha carrega
 * gravidade, contexto, tempo e ação. Cor só como sinal.
 */

const COR_SEVERIDADE: Record<Severidade, string> = {
  URGENTE: "var(--danger)",
  ATENCAO: "var(--warning)",
  INFO: "var(--muted-2)",
};

const LINHA =
  "-mx-2 rounded-md px-2 transition-colors duration-150 hover:bg-surface-2/45 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40";

export function TituloSecao({
  titulo,
  meta,
  href,
  hrefLabel,
}: {
  titulo: string;
  meta?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-1.5">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{titulo}</h2>
        {meta && <span className="truncate text-[11px] text-muted-2">{meta}</span>}
      </div>
      {href && (
        <Link
          href={href}
          className="group -mx-1.5 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:text-brand"
        >
          {hrefLabel ?? "Abrir"}
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      )}
    </header>
  );
}

// ─── Sua atenção ─────────────────────────────────────────────────────────────

export function LinhaAtencao({ item }: { item: ItemAtencao }) {
  return (
    <Link href={item.destino} className={`group flex items-center gap-2.5 py-[7px] ${LINHA}`}>
      <span
        aria-hidden
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{
          background: COR_SEVERIDADE[item.severidade],
          boxShadow: `0 0 0 3px color-mix(in srgb, ${COR_SEVERIDADE[item.severidade]} 13%, transparent)`,
        }}
      />

      <span className="min-w-0 flex-1 truncate text-[12.5px] leading-tight">
        <span className="font-medium text-foreground">{item.titulo}</span>
        <span className="text-muted"> — {item.detalhe}</span>
      </span>

      <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.08em] text-muted-2 sm:inline">
        {LABEL_FONTE[item.fonte]}
      </span>

      <span className="flex w-[112px] shrink-0 items-center justify-end gap-1 text-[11px] font-medium text-muted-2 transition-colors duration-150 group-hover:text-brand">
        {item.acaoLabel}
        <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function TudoSobControle() {
  return (
    <div className="flex items-baseline gap-2 py-2.5">
      <Check className="h-[13px] w-[13px] shrink-0 translate-y-[2px]" style={{ color: "var(--success)" }} />
      <span className="text-[12px] font-medium text-foreground-2">Tudo sob controle</span>
      <span className="truncate text-[12px] text-muted">Nenhuma urgência exige sua atenção.</span>
    </div>
  );
}

// ─── Agora / Próximo ─────────────────────────────────────────────────────────

export function LinhaAgenda({ item }: { item: ItemAgenda }) {
  return (
    <Link href={item.destino} className={`flex items-center gap-3 py-[7px] ${LINHA}`}>
      <span
        className={`w-[42px] shrink-0 text-[12px] font-semibold tabular-nums ${
          item.hora ? "text-foreground" : "text-muted-2"
        }`}
      >
        {item.hora ?? "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{item.titulo}</span>
      <span className="hidden shrink-0 truncate text-[11px] text-muted sm:inline">{item.detalhe}</span>
    </Link>
  );
}

// ─── Tarefas de hoje ─────────────────────────────────────────────────────────

const COR_PRIORIDADE: Record<string, string> = {
  high: "var(--danger)",
  medium: "var(--warning)",
  low: "var(--muted-2)",
};

export function LinhaTarefa({
  tarefa,
  concluindo,
  onConcluir,
}: {
  tarefa: TarefaDoDia;
  concluindo: boolean;
  onConcluir: () => void;
}) {
  return (
    <div className={`flex items-center gap-2.5 py-[7px] ${LINHA}`}>
      <button
        onClick={onConcluir}
        disabled={concluindo}
        aria-label={`Concluir ${tarefa.title}`}
        className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border border-border transition-colors duration-150 hover:border-[color:var(--success)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
      >
        {concluindo && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted" />}
      </button>

      <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{tarefa.title}</span>

      {tarefa.clienteNome && (
        <span className="hidden shrink-0 truncate text-[11px] text-muted-2 sm:inline">
          {tarefa.clienteNome}
        </span>
      )}

      <span
        className="hidden shrink-0 text-[10px] uppercase tracking-[0.08em] sm:inline"
        style={{ color: COR_PRIORIDADE[tarefa.priority] ?? "var(--muted-2)" }}
      >
        {tarefa.priority === "high" ? "Alta" : tarefa.priority === "low" ? "Baixa" : "Média"}
      </span>

      <span
        className={`w-[72px] shrink-0 text-right text-[11px] font-medium tabular-nums ${
          tarefa.atrasada ? "text-[color:var(--danger)]" : "text-muted"
        }`}
      >
        {tarefa.atrasada
          ? `${Math.abs(tarefa.diasAteVencer)}d atrasada`
          : "vence hoje"}
      </span>
    </div>
  );
}

// ─── Próximos ────────────────────────────────────────────────────────────────

export function LinhaProximo({ item }: { item: ItemProximo }) {
  return (
    <Link href={item.destino} className={`flex items-center gap-3 py-[7px] ${LINHA}`}>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground-2">{item.titulo}</span>
      <span className="hidden shrink-0 truncate text-[11px] text-muted-2 sm:inline">{item.detalhe}</span>
      <span className="w-[64px] shrink-0 text-right text-[11px] tabular-nums text-muted">
        {item.emDias === 1 ? "amanhã" : `em ${item.emDias} dias`}
      </span>
    </Link>
  );
}

/** Vazio de uma linha só — a tela nunca abre um buraco. */
export function VazioCompacto({ texto }: { texto: string }) {
  return <p className="py-2.5 text-[12px] text-muted">{texto}</p>;
}
