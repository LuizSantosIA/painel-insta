"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { AlertaNegocio, Severidade } from "@/lib/negocio-overview";
import { Dot, EmptyState, Panel, PanelHeader, type Tom } from "./panel";

const TOM_POR_SEVERIDADE: Record<Severidade, Tom> = {
  URGENTE: "URGENTE",
  ATENCAO: "ATENCAO",
  INFO: "NEUTRO",
};

/** Quantos alertas aparecem antes do "ver mais". */
const LIMITE_INICIAL = 6;

export function AttentionItem({ alerta }: { alerta: AlertaNegocio }) {
  return (
    <Link
      href={alerta.destino}
      className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/40"
    >
      <Dot tom={TOM_POR_SEVERIDADE[alerta.severidade]} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground-2">
        <span className="font-medium text-foreground">{alerta.titulo}</span>
        <span className="text-muted"> — {alerta.detalhe}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-2 transition-colors group-hover:text-brand">
        {alerta.destinoLabel}
        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function AttentionList({ alertas }: { alertas: AlertaNegocio[] }) {
  const [expandido, setExpandido] = useState(false);

  const urgentes = alertas.filter((a) => a.severidade === "URGENTE").length;
  const visiveis = expandido ? alertas : alertas.slice(0, LIMITE_INICIAL);
  const restantes = alertas.length - visiveis.length;

  const subtitulo =
    alertas.length === 0
      ? "Itens que podem exigir uma decisão ou ação sua."
      : urgentes > 0
        ? `${alertas.length} ${alertas.length === 1 ? "item" : "itens"} · ${urgentes} ${urgentes === 1 ? "urgente" : "urgentes"}`
        : `${alertas.length} ${alertas.length === 1 ? "item" : "itens"} para revisar`;

  return (
    <Panel>
      <PanelHeader titulo="Precisa da sua atenção" subtitulo={subtitulo} />

      {alertas.length === 0 ? (
        <EmptyState
          titulo="Nada pendente"
          descricao="Compromissos, tarefas, leads e pagamentos estão todos em dia."
        />
      ) : (
        <>
          <div className="divide-y divide-border-subtle">
            {visiveis.map((alerta) => (
              <AttentionItem key={alerta.id} alerta={alerta} />
            ))}
          </div>

          {restantes > 0 && (
            <button
              onClick={() => setExpandido(true)}
              className="w-full border-t border-border-subtle px-4 py-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2/40 hover:text-foreground-2"
            >
              Ver mais {restantes} {restantes === 1 ? "item" : "itens"}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
