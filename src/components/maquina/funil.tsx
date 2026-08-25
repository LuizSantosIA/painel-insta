import { fmtBRL } from "@/lib/financeiro";
import { fmtTaxa, type EtapaFunil } from "@/lib/maquina";
import { EmptyLine, Section, SectionHeader } from "@/components/negocio/panel";

/**
 * O funil da aquisição, de cima para baixo.
 *
 * A barra é proporcional à primeira etapa com número, e não a cada etapa isolada —
 * é assim que a queda entre alcance e conversa fica visível em vez de virar sete
 * barras cheias. Etapa que não pôde ser medida mostra "—" e diz o motivo; nenhuma
 * delas recebe um valor estimado para "fechar" o desenho.
 */

const COR_ETAPA: Record<string, string> = {
  visualizacoes: "#00D4FF",
  interacoes: "#4F8CFF",
  conversas: "#7C5CFF",
  leads: "#4F8CFF",
  oportunidades: "#F59E0B",
  clientes: "#22C55E",
  receita: "#22C55E",
};

function fmtValor(etapa: EtapaFunil): string {
  if (etapa.valor === null) return "—";
  if (etapa.unidade === "dinheiro") return fmtBRL(etapa.valor);
  return etapa.valor.toLocaleString("pt-BR");
}

export function Funil({ etapas }: { etapas: EtapaFunil[] }) {
  const base = etapas.find((e) => e.valor !== null && e.valor > 0)?.valor ?? 0;
  const semDados = etapas.every((e) => e.valor === null || e.valor === 0);

  return (
    <Section>
      <SectionHeader
        titulo="Funil de aquisição"
        meta={semDados ? undefined : "conteúdo → receita"}
      />

      {semDados ? (
        <EmptyLine
          titulo="Sem dados suficientes"
          descricao="Sincronize conteúdos e conversas para o funil aparecer."
        />
      ) : (
        <div className="divide-y divide-border-subtle/70">
          {etapas.map((etapa) => {
            const cor = COR_ETAPA[etapa.chave] ?? "var(--muted-2)";
            const medivel = etapa.valor !== null;
            // Escala logarítmica: entre 5.000 alcances e 3 leads, a linear some.
            const proporcao =
              medivel && etapa.valor! > 0 && base > 0
                ? Math.max(4, (Math.log10(etapa.valor! + 1) / Math.log10(base + 1)) * 100)
                : 0;

            return (
              <div key={etapa.chave} className="flex items-center gap-3 py-[7px]">
                <span className="w-[104px] shrink-0 truncate text-[12px] text-foreground-2">
                  {etapa.label}
                </span>

                <span
                  className={`w-[92px] shrink-0 text-right text-[13px] font-semibold tabular-nums ${
                    medivel ? "text-foreground" : "text-muted-2"
                  }`}
                >
                  {fmtValor(etapa)}
                </span>

                <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${proporcao}%`, background: cor, opacity: 0.85 }}
                  />
                </div>

                <span
                  className="hidden w-[150px] shrink-0 truncate text-[11px] text-muted-2 sm:block"
                  title={etapa.fonte}
                >
                  {etapa.fonte}
                </span>

                <span
                  className={`w-[52px] shrink-0 text-right text-[11px] tabular-nums ${
                    etapa.taxa === null ? "text-muted-2" : "text-muted"
                  }`}
                  title={etapa.taxa === null ? "sem etapa anterior comparável" : "conversão da etapa anterior"}
                >
                  {fmtTaxa(etapa.taxa)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
