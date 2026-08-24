import { fmtBRL, type ResumoFinanceiro } from "@/lib/financeiro";
import { Panel, PanelHeader, TRACO } from "./panel";

interface Linha {
  label: string;
  valor: string;
  nota?: string;
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
          ? `${resumo.mrrVariacao > 0 ? "+" : ""}${resumo.mrrVariacao.toFixed(0)}% vs. mês anterior`
          : undefined,
      atenuado: resumo.mrrAtual === 0,
    },
    {
      label: "Receita pontual do mês",
      valor: resumo.receitaPontual > 0 ? fmtBRL(resumo.receitaPontual) : TRACO,
      atenuado: resumo.receitaPontual === 0,
    },
    {
      label: "A receber",
      valor: resumo.aReceber > 0 ? fmtBRL(resumo.aReceber) : TRACO,
      nota: aReceberVencido > 0 ? `${fmtBRL(aReceberVencido)} vencidos` : undefined,
      atenuado: resumo.aReceber === 0,
    },
    {
      label: "Runway",
      valor: resumo.runway !== null ? `${resumo.runway} meses` : TRACO,
      nota: resumo.runway === null ? "precisa de 3 meses de despesas" : undefined,
      atenuado: resumo.runway === null,
    },
  ];

  return (
    <Panel>
      <PanelHeader titulo="Financeiro" href="/negocio/financeiro" hrefLabel="Abrir financeiro" />

      <div className="divide-y divide-border-subtle">
        {linhas.map((linha) => (
          <div key={linha.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <span className="min-w-0 truncate text-[12px] text-foreground-2">{linha.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              {linha.nota && (
                <span
                  className={`text-[11px] tabular-nums ${
                    linha.label === "A receber" ? "text-[color:var(--warning)]" : "text-muted-2"
                  }`}
                >
                  {linha.nota}
                </span>
              )}
              <span
                className={`text-[15px] font-semibold tabular-nums tracking-tight ${
                  linha.atenuado ? "text-muted-2" : "text-foreground"
                }`}
              >
                {linha.valor}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
