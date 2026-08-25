"use client";

import { fmtBRL } from "@/lib/financeiro";
import type { SaudeResumo } from "@/lib/negocio-overview";
import { labelSaude, tomSaude, type StatusSaude } from "@/lib/saude";
import { Dot, Label, TRACO } from "@/components/negocio/panel";

/**
 * Faixa executiva da carteira: contagem por faixa e quanto de recorrência está
 * preso nos clientes que precisam de atenção.
 *
 * Sem esferas coloridas: o que informa é o número, o rótulo e um ponto semântico
 * de 6px. Cada célula é um filtro — clicar mostra só aquela faixa.
 */

const FAIXAS: { status: StatusSaude; chave: keyof Omit<SaudeResumo, "total" | "mrrEmRiscoCentavos"> }[] = [
  { status: "VERMELHO", chave: "vermelho" },
  { status: "AMARELO", chave: "amarelo" },
  { status: "SEM_DADOS", chave: "semDados" },
  { status: "VERDE", chave: "verde" },
];

export type FiltroFaixa = "TODOS" | StatusSaude;

export function FaixaCarteira({
  resumo,
  ativo,
  onSelecionar,
  carregando = false,
}: {
  resumo: SaudeResumo;
  ativo: FiltroFaixa;
  onSelecionar: (faixa: FiltroFaixa) => void;
  carregando?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {FAIXAS.map((faixa, i) => {
          const quantidade = resumo[faixa.chave];
          const selecionado = ativo === faixa.status;
          return (
            <button
              key={faixa.status}
              onClick={() => onSelecionar(selecionado ? "TODOS" : faixa.status)}
              aria-pressed={selecionado}
              className={[
                "flex min-w-0 flex-col gap-1.5 px-4 py-2.5 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand/45",
                selecionado ? "bg-surface-2/60" : "hover:bg-surface-2/35",
                i > 0 ? "border-t border-border-subtle sm:border-t-0" : "",
                i % 2 === 1 ? "border-l border-border-subtle sm:border-l-0" : "",
                i % 3 !== 0 ? "sm:border-l sm:border-border-subtle" : "",
                i >= 3 ? "sm:border-t sm:border-border-subtle lg:border-t-0" : "",
                i > 0 ? "lg:border-l lg:border-border-subtle" : "",
              ].join(" ")}
            >
              <span
                className={`text-[20px] font-semibold leading-none tracking-tight tabular-nums ${
                  carregando || quantidade === 0 ? "text-muted-2" : "text-foreground"
                }`}
              >
                {carregando ? TRACO : quantidade}
              </span>
              <span className="flex items-center gap-1.5">
                <Dot tom={tomSaude(faixa.status)} />
                <span className="truncate text-[11px] text-muted">
                  {faixa.status === "VERDE" ? "Saudáveis" : labelSaude(faixa.status)}
                </span>
              </span>
            </button>
          );
        })}

        {/* Dinheiro em jogo vale mais que "2 clientes vermelhos". */}
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 border-t border-border-subtle px-4 py-2.5 sm:col-span-1 sm:border-l lg:border-t-0">
          <span
            className={`text-[20px] font-semibold leading-none tracking-tight tabular-nums ${
              resumo.mrrEmRiscoCentavos > 0 ? "text-[color:var(--warning)]" : "text-muted-2"
            }`}
          >
            {carregando || resumo.mrrEmRiscoCentavos === 0
              ? TRACO
              : fmtBRL(resumo.mrrEmRiscoCentavos)}
          </span>
          <Label>MRR em risco</Label>
        </div>
      </div>
    </div>
  );
}
