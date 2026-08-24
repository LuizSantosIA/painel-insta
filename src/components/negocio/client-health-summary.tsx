import Link from "next/link";
import type { SaudeResumo } from "@/lib/negocio-overview";
import { Dot, EmptyState, Panel, PanelHeader, type Tom } from "./panel";

const FAIXAS: { chave: keyof Omit<SaudeResumo, "total">; label: string; tom: Tom; filtro: string }[] = [
  { chave: "vermelho", label: "Em risco", tom: "URGENTE", filtro: "VERMELHO" },
  { chave: "amarelo", label: "Atenção", tom: "ATENCAO", filtro: "AMARELO" },
  { chave: "verde", label: "Saudáveis", tom: "OK", filtro: "VERDE" },
];

export function ClientHealthSummary({ resumo }: { resumo: SaudeResumo }) {
  return (
    <Panel>
      <PanelHeader titulo="Saúde dos clientes" href="/negocio/saude" hrefLabel="Ver clientes" />

      {resumo.total === 0 ? (
        <EmptyState
          titulo="Nenhum cliente cadastrado"
          descricao="A saúde da carteira aparece aqui assim que você cadastrar o primeiro cliente."
        />
      ) : (
        <div className="divide-y divide-border-subtle">
          {FAIXAS.map((faixa) => {
            const quantidade = resumo[faixa.chave];
            return (
              <Link
                key={faixa.chave}
                href="/negocio/saude"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40"
              >
                <Dot tom={faixa.tom} />
                <span className="w-8 shrink-0 text-[17px] font-semibold tabular-nums tracking-tight text-foreground">
                  {quantidade}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">
                  {faixa.label}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-2">
                  {resumo.total > 0 ? `${Math.round((quantidade / resumo.total) * 100)}%` : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
