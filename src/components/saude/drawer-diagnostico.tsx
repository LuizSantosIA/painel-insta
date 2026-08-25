"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, MessageSquarePlus, Phone, X } from "lucide-react";
import { fmtDataHumana } from "@/lib/cliente-360";
import { CONFIG_SAUDE } from "@/lib/saude";
import type { ClienteSaudeItem } from "@/app/api/clientes/saude/route";
import { Avatar, StatusBadge } from "@/components/cliente/saude-indicator";
import { Label } from "@/components/negocio/panel";
import { DiagnosticoDetalhe, SaudeEtiqueta } from "./diagnostico-detalhe";

/**
 * Painel lateral do diagnóstico.
 *
 * Mostra por que o cliente recebeu a classificação e o que fazer — não repete o
 * perfil 360°. Para o resto do relacionamento existe o "Abrir cliente".
 */
export function DrawerDiagnostico({
  item,
  onFechar,
  onRegistrarContato,
  onAdicionarObservacao,
}: {
  item: ClienteSaudeItem;
  onFechar: () => void;
  onRegistrarContato: () => void;
  onAdicionarObservacao: () => void;
}) {
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  const d = item.diagnostico;
  const acao = d.acaoRecomendada;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" onClick={onFechar} />

      <aside
        aria-label={`Diagnóstico de ${item.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border bg-background shadow-[0_0_60px_rgba(0,0,0,0.5)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <Avatar nome={item.name} tamanho={32} />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                {item.name}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <SaudeEtiqueta diagnostico={d} compacto />
                <StatusBadge status={item.status} />
              </div>
            </div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="-mr-1 rounded-md p-1 text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Ação recomendada — derivada do sinal mais grave, sem IA */}
          {acao && (
            <div className="rounded-[10px] border border-border-subtle bg-surface/50 p-3">
              <Label>Próxima ação</Label>
              <div className="mt-1.5">
                {acao.destino ? (
                  <Link
                    href={acao.destino}
                    className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground transition-colors duration-150 hover:text-brand"
                  >
                    {acao.label}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <button
                    onClick={onRegistrarContato}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand/40 bg-brand/10 px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors duration-150 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50"
                  >
                    <Phone className="h-3 w-3" />
                    {acao.label}
                  </button>
                )}
              </div>
            </div>
          )}

          <DiagnosticoDetalhe diagnostico={d} clienteId={item.id} />

          {item.observacao && (
            <div className="border-t border-border-subtle pt-3">
              <Label>Observação</Label>
              <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground-2">
                {item.observacao.texto}
              </p>
              {item.observacao.em && (
                <p className="mt-1 text-[11px] text-muted-2">
                  {fmtDataHumana(item.observacao.em)}
                </p>
              )}
            </div>
          )}

          <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-muted-2">
            Score {d.score}/100 · saudável a partir de {CONFIG_SAUDE.LIMIAR_VERDE}, risco abaixo de{" "}
            {CONFIG_SAUDE.LIMIAR_AMARELO}.
          </p>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-5 py-3">
          <button
            onClick={onRegistrarContato}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface-2/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground-2 transition-all duration-150 hover:border-brand/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/50 active:scale-[0.98]"
          >
            <Phone className="h-3.5 w-3.5" />
            Registrar contato
          </button>
          <button
            onClick={onAdicionarObservacao}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/45"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Observação
          </button>
          <Link
            href={`/negocio/clientes/${item.id}`}
            className="group ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-brand transition-colors duration-150 hover:text-foreground"
          >
            Abrir cliente
            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </footer>
      </aside>
    </>
  );
}
