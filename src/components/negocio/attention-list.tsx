"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { AlertaNegocio, Severidade } from "@/lib/negocio-overview";
import { Dot, LINHA_HOVER, Section, SectionHeader, type Tom } from "./panel";

const TOM_POR_SEVERIDADE: Record<Severidade, Tom> = {
  URGENTE: "URGENTE",
  ATENCAO: "ATENCAO",
  INFO: "NEUTRO",
};

/** Quantos alertas aparecem antes do "ver mais". */
const LIMITE_INICIAL = 6;

export function AttentionItem({ alerta }: { alerta: AlertaNegocio }) {
  return (
    <Link href={alerta.destino} className={`group flex items-center gap-2.5 py-[7px] ${LINHA_HOVER}`}>
      <Dot tom={TOM_POR_SEVERIDADE[alerta.severidade]} />
      <span className="min-w-0 flex-1 truncate text-[12.5px] leading-tight">
        <span className="font-medium text-foreground">{alerta.titulo}</span>
        <span className="text-muted"> — {alerta.detalhe}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-2 transition-colors duration-150 group-hover:text-brand">
        {alerta.destinoLabel}
        <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function AttentionList({ alertas }: { alertas: AlertaNegocio[] }) {
  const [expandido, setExpandido] = useState(false);

  const urgentes = alertas.filter((a) => a.severidade === "URGENTE").length;
  const visiveis = expandido ? alertas : alertas.slice(0, LIMITE_INICIAL);
  const restantes = alertas.length - visiveis.length;

  const meta =
    alertas.length === 0
      ? undefined
      : urgentes > 0
        ? `${alertas.length} · ${urgentes} ${urgentes === 1 ? "urgente" : "urgentes"}`
        : `${alertas.length} ${alertas.length === 1 ? "item" : "itens"}`;

  return (
    <Section>
      <SectionHeader titulo="Precisa da sua atenção" meta={meta} />

      {alertas.length === 0 ? (
        <div className="flex items-baseline gap-2 py-2.5">
          <Check
            className="h-[13px] w-[13px] shrink-0 translate-y-[2px]"
            style={{ color: "var(--success)" }}
          />
          <span className="text-[12px] font-medium text-foreground-2">Tudo em dia</span>
          <span className="truncate text-[12px] text-muted">
            Nenhuma ação exige sua atenção agora.
          </span>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border-subtle/70">
            {visiveis.map((alerta) => (
              <AttentionItem key={alerta.id} alerta={alerta} />
            ))}
          </div>

          {restantes > 0 && (
            <button
              onClick={() => setExpandido(true)}
              className="-mx-2 mt-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted transition-colors duration-150 hover:text-foreground-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
            >
              Ver mais {restantes} {restantes === 1 ? "item" : "itens"}
            </button>
          )}
        </>
      )}
    </Section>
  );
}
