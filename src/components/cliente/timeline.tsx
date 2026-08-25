import type { EventoTimeline, TipoEvento } from "@/lib/cliente-360";
import { fmtDataHumana } from "@/lib/cliente-360";
import { EmptyLine, Section, SectionHeader } from "@/components/negocio/panel";

/**
 * Histórico do relacionamento.
 *
 * Cada evento vem de um carimbo de data que existe de verdade no banco. Não há
 * reconstrução retroativa: o que aconteceu antes de existir o campo simplesmente
 * não aparece.
 */

/** Cor do marcador por natureza do evento — sinal, não decoração. */
const COR_EVENTO: Record<TipoEvento, string> = {
  CLIENTE_CRIADO: "var(--muted-2)",
  INTERACAO: "var(--brand)",
  OPORTUNIDADE_CRIADA: "var(--brand-2)",
  TAREFA_CRIADA: "var(--muted-2)",
  TAREFA_CONCLUIDA: "var(--success)",
  COMPROMISSO_CRIADO: "var(--muted-2)",
  COMPROMISSO_CUMPRIDO: "var(--success)",
  RECEITA_REGISTRADA: "var(--warning)",
  RECEITA_RECEBIDA: "var(--success)",
};

export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  return (
    <Section>
      <SectionHeader
        titulo="Histórico"
        meta={eventos.length > 0 ? `${eventos.length} eventos` : undefined}
      />

      {eventos.length === 0 ? (
        <EmptyLine titulo="Sem histórico" descricao="Os eventos aparecem aqui conforme acontecem." />
      ) : (
        <ol className="relative mt-1">
          {/* fio contínuo atrás dos marcadores */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[3px] top-2 w-px"
            style={{ background: "var(--border-subtle)" }}
          />
          {eventos.map((e) => (
            <li key={e.id} className="relative flex gap-3 py-[7px] pl-4">
              <span
                aria-hidden
                className="absolute left-0 top-[13px] h-[7px] w-[7px] rounded-full ring-2"
                style={{ background: COR_EVENTO[e.tipo], color: "var(--background)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-tight">
                  <span className="font-medium text-foreground">{e.titulo}</span>
                  {e.detalhe && <span className="text-muted"> — {e.detalhe}</span>}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-2">
                {fmtDataHumana(e.em)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
