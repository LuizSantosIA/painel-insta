import { fmtBRL } from "@/lib/financeiro";
import type { PipelineResumo } from "@/lib/negocio-overview";
import { EmptyState, Label, Panel, PanelHeader, Valor } from "./panel";

/** Cor por estágio — mesma escala usada na tela de Pipeline. */
const COR_ESTAGIO: Record<string, string> = {
  LEAD: "#4F8CFF",
  QUALIFICADO: "#7C5CFF",
  PROPOSTA_ENVIADA: "#F59E0B",
  NEGOCIACAO: "#F97316",
};

export function PipelineSummary({ resumo }: { resumo: PipelineResumo }) {
  const vazio = resumo.quantidade === 0;

  // A barra usa quantidade, não valor: lead sem valor estimado ainda ocupa o funil.
  const maiorQuantidade = Math.max(...resumo.estagios.map((e) => e.quantidade), 1);

  return (
    <Panel>
      <PanelHeader titulo="Pipeline" href="/negocio/pipeline" hrefLabel="Ver pipeline" />

      {vazio ? (
        <EmptyState
          titulo="Nenhuma oportunidade aberta"
          descricao="Seu pipeline aparecerá aqui quando você adicionar um lead."
        />
      ) : (
        <>
          <div className="flex items-end justify-between gap-4 border-b border-border-subtle px-4 py-3.5">
            <div className="flex flex-col gap-1">
              <Label>Total aberto</Label>
              <Valor>{fmtBRL(resumo.totalCentavos)}</Valor>
            </div>
            <p className="pb-0.5 text-[11px] text-muted">
              {resumo.quantidade} {resumo.quantidade === 1 ? "oportunidade" : "oportunidades"}
            </p>
          </div>

          <div className="divide-y divide-border-subtle">
            {resumo.estagios.map((e) => {
              const cor = COR_ESTAGIO[e.estagio] ?? "var(--muted-2)";
              const proporcao = (e.quantidade / maiorQuantidade) * 100;

              return (
                <div key={e.estagio} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-[86px] shrink-0 truncate text-[12px] text-foreground-2">
                      {e.label}
                    </span>
                    <span className="w-6 shrink-0 text-[12px] tabular-nums text-muted">
                      {e.quantidade}
                    </span>
                    <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${proporcao}%`,
                          background: cor,
                          opacity: e.quantidade === 0 ? 0 : 0.85,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-foreground-2">
                      {e.valorCentavos > 0 ? fmtBRL(e.valorCentavos) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
