import { dicaRunway, fmtBRL, fmtVariacao, type ResumoFinanceiro } from "@/lib/financeiro";
import { Section, SectionHeader, TRACO } from "./panel";

/**
 * O financeiro no painel executivo.
 *
 * Lê o mesmo ResumoFinanceiro que a tela de Financeiro — nenhum número é
 * recalculado aqui. Se um valor divergir entre as duas telas, o bug está em
 * financeiro.ts, não neste componente.
 */

interface Linha {
  label: string;
  valor: string;
  nota?: string;
  notaAlerta?: boolean;
  atenuado?: boolean;
}

export function FinanceSummary({
  resumo,
  aReceberVencido,
}: {
  resumo: ResumoFinanceiro;
  aReceberVencido: number;
}) {
  const linhas: Linha[] = [
    {
      label: "MRR",
      valor: resumo.mrrAtual > 0 ? fmtBRL(resumo.mrrAtual) : TRACO,
      nota:
        resumo.mrrVariacao !== null
          ? `${fmtVariacao(resumo.mrrVariacao)} vs. mês anterior`
          : undefined,
      atenuado: resumo.mrrAtual === 0,
    },
    {
      label: "Recebido no mês",
      valor: resumo.recebido > 0 ? fmtBRL(resumo.recebido) : TRACO,
      nota:
        resumo.recebidoPontual > 0 ? `${fmtBRL(resumo.recebidoPontual)} pontual` : undefined,
      atenuado: resumo.recebido === 0,
    },
    {
      label: "A receber",
      valor: resumo.aReceber > 0 ? fmtBRL(resumo.aReceber) : TRACO,
      nota: aReceberVencido > 0 ? `${fmtBRL(aReceberVencido)} vencidos` : undefined,
      notaAlerta: aReceberVencido > 0,
      atenuado: resumo.aReceber === 0,
    },
    {
      label: "Runway",
      valor:
        resumo.runway !== null
          ? `${resumo.runway} ${resumo.runway === 1 ? "mês" : "meses"}`
          : TRACO,
      nota:
        resumo.runway === null
          ? dicaRunway({
              meses: null,
              motivo: resumo.runwayMotivo,
              burnMedioCentavos: resumo.burnMedioCentavos,
            })
          : undefined,
      atenuado: resumo.runway === null,
    },
  ];

  return (
    <Section>
      <SectionHeader titulo="Financeiro" href="/negocio/financeiro" hrefLabel="Abrir financeiro" />

      <div className="divide-y divide-border-subtle/70">
        {linhas.map((linha) => (
          <div key={linha.label} className="flex items-baseline justify-between gap-4 py-[7px]">
            <span className="min-w-0 truncate text-[12px] text-foreground-2">{linha.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              {linha.nota && (
                <span
                  className={`text-[11px] tabular-nums ${
                    linha.notaAlerta ? "text-[color:var(--warning)]" : "text-muted-2"
                  }`}
                >
                  {linha.nota}
                </span>
              )}
              <span
                className={`text-[14px] font-semibold tabular-nums tracking-tight ${
                  linha.atenuado ? "text-muted-2" : "text-foreground"
                }`}
              >
                {linha.valor}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
