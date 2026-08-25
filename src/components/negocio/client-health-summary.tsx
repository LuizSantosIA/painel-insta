import Link from "next/link";
import { fmtBRL } from "@/lib/financeiro";
import type { SaudeResumo } from "@/lib/negocio-overview";
import { Dot, EmptyLine, LINHA_HOVER, Section, SectionHeader, type Tom } from "./panel";

/**
 * As faixas vêm da engine de saúde (saude.ts). "Sem dados" existe para separar o
 * cliente que está bem daquele sobre quem ainda não sabemos nada.
 */
const FAIXAS: {
  chave: keyof Omit<SaudeResumo, "total" | "mrrEmRiscoCentavos">;
  label: string;
  tom: Tom;
  filtro: string;
}[] = [
  { chave: "vermelho", label: "Em risco", tom: "URGENTE", filtro: "VERMELHO" },
  { chave: "amarelo", label: "Atenção", tom: "ATENCAO", filtro: "AMARELO" },
  { chave: "semDados", label: "Sem dados", tom: "NEUTRO", filtro: "SEM_DADOS" },
  { chave: "verde", label: "Saudáveis", tom: "OK", filtro: "VERDE" },
];

export function ClientHealthSummary({ resumo }: { resumo: SaudeResumo }) {
  return (
    <Section>
      <SectionHeader
        titulo="Saúde dos clientes"
        meta={resumo.total > 0 ? `${resumo.total} na carteira` : undefined}
        href="/negocio/saude"
        hrefLabel="Ver diagnóstico"
      />

      {resumo.total === 0 ? (
        <EmptyLine
          titulo="Nenhum cliente cadastrado"
          descricao="A saúde da carteira aparece aqui depois do primeiro."
        />
      ) : (
        <>
          <div className="divide-y divide-border-subtle/70">
            {FAIXAS.map((faixa) => {
              const quantidade = resumo[faixa.chave];
              return (
                <Link
                  key={faixa.chave}
                  href={`/negocio/saude?faixa=${faixa.filtro}`}
                  className={`flex items-center gap-2.5 py-[7px] ${LINHA_HOVER}`}
                >
                  <Dot tom={faixa.tom} />
                  <span
                    className={`w-6 shrink-0 text-[14px] font-semibold tabular-nums tracking-tight ${
                      quantidade === 0 ? "text-muted-2" : "text-foreground"
                    }`}
                  >
                    {quantidade}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-2">
                    {faixa.label}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-2">
                    {Math.round((quantidade / resumo.total) * 100)}%
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Saber quanto dinheiro está preso nos clientes ruins vale mais que a contagem. */}
          {resumo.mrrEmRiscoCentavos > 0 && (
            <p className="mt-1.5 text-[11px] text-muted">
              <span className="tabular-nums text-[color:var(--warning)]">
                {fmtBRL(resumo.mrrEmRiscoCentavos)}
              </span>{" "}
              de recorrência em clientes que precisam de atenção
            </p>
          )}
        </>
      )}
    </Section>
  );
}
