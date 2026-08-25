"use client";

import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { fmtBRL } from "@/lib/financeiro";
import { fmtDataHumana } from "@/lib/cliente-360";
import type { ClienteSaudeItem } from "@/app/api/clientes/saude/route";
import { TRACO } from "@/components/negocio/panel";
import { SaudeEtiqueta } from "./diagnostico-detalhe";

/**
 * Uma linha da carteira: cliente → diagnóstico → ação.
 *
 * Densa de propósito: uma linha por cliente, sem card, sem altura desperdiçada.
 * O motivo é a coluna mais larga porque é a informação que a tela existe para dar.
 */

export const COLUNAS_SAUDE = [
  "Cliente",
  "Saúde",
  "Motivo",
  "Último contato",
  "Receita",
  "Próxima ação",
];

/** Mesma grade do cabeçalho e das linhas — mudar aqui muda as duas. */
const GRADE =
  "grid grid-cols-1 gap-x-3 gap-y-1 lg:grid-cols-[minmax(0,1.15fr)_92px_minmax(0,1.75fr)_98px_106px_minmax(0,150px)] lg:items-center";

export function CabecalhoCarteira() {
  return (
    <div className={`${GRADE} border-b border-border-subtle px-2 pb-1.5`}>
      {COLUNAS_SAUDE.map((col, i) => (
        <span
          key={col}
          className={`text-[10px] font-medium uppercase tracking-[0.09em] text-muted-2 ${
            i === 0 ? "" : "hidden lg:block"
          }`}
        >
          {col}
        </span>
      ))}
    </div>
  );
}

/** Receita da linha: MRR quando há recorrência, senão o total já recebido. */
function receita(item: ClienteSaudeItem): { valor: string; sufixo: string | null } | null {
  if (item.diagnostico.mrrCentavos > 0) {
    return { valor: fmtBRL(item.diagnostico.mrrCentavos), sufixo: "/mês" };
  }
  if (item.receitaRecebidaCentavos > 0) {
    return { valor: fmtBRL(item.receitaRecebidaCentavos), sufixo: null };
  }
  return null;
}

export function LinhaCliente({
  item,
  onAbrir,
  onRegistrarContato,
}: {
  item: ClienteSaudeItem;
  onAbrir: () => void;
  onRegistrarContato: () => void;
}) {
  const d = item.diagnostico;
  const extras = Math.max(d.motivos.length - 1, 0);
  const valor = receita(item);
  const acao = d.acaoRecomendada;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      className={`${GRADE} cursor-pointer rounded-md border-b border-border-subtle/70 px-2 py-2 transition-colors duration-150 hover:bg-surface-2/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40`}
    >
      {/* Cliente */}
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[12.5px] font-medium text-foreground">{item.name}</span>
        {item.company && (
          <span className="hidden truncate text-[11px] text-muted-2 lg:block">{item.company}</span>
        )}
      </div>

      {/* Saúde */}
      <div className="min-w-0">
        <SaudeEtiqueta diagnostico={d} compacto />
      </div>

      {/* Motivo */}
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-[12px] text-muted">{d.resumo}</span>
        {extras > 0 && (
          <span className="shrink-0 rounded-[5px] border border-border px-1 text-[10px] tabular-nums text-muted-2">
            +{extras}
          </span>
        )}
      </div>

      {/* Último contato */}
      <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted-2">
        {fmtDataHumana(d.ultimaInteracaoEm)}
      </span>

      {/* Receita */}
      <span className="whitespace-nowrap text-[11.5px] tabular-nums">
        {valor ? (
          <>
            <span className="text-foreground-2">{valor.valor}</span>
            {valor.sufixo && <span className="text-muted-2">{valor.sufixo}</span>}
          </>
        ) : (
          <span className="text-muted-2">{TRACO}</span>
        )}
      </span>

      {/* Próxima ação: a recomendação da engine, ou o compromisso já marcado */}
      <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
        {acao ? (
          acao.destino ? (
            <Link
              href={acao.destino}
              className="group inline-flex max-w-full items-center gap-1 truncate rounded-[7px] border border-border px-2 py-[3px] text-[11px] font-medium text-foreground-2 transition-colors duration-150 hover:border-brand/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
            >
              {acao.label}
              <ArrowRight className="h-3 w-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <button
              onClick={onRegistrarContato}
              className="inline-flex max-w-full items-center gap-1 truncate rounded-[7px] border border-brand/35 bg-brand/10 px-2 py-[3px] text-[11px] font-medium text-foreground transition-colors duration-150 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50"
            >
              <Phone className="h-3 w-3 shrink-0" />
              {acao.label}
            </button>
          )
        ) : item.proximaAcao ? (
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-[11.5px] text-muted">{item.proximaAcao.titulo}</span>
            <span
              className={`shrink-0 text-[11px] ${
                item.proximaAcao.atrasado ? "text-[color:var(--danger)]" : "text-muted-2"
              }`}
            >
              · {item.proximaAcao.quando}
            </span>
          </span>
        ) : (
          <span className="text-[11.5px] text-muted-2">{TRACO}</span>
        )}
      </div>
    </div>
  );
}
