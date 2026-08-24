import Link from "next/link";
import type { ProximoItem } from "@/lib/negocio-overview";
import { EmptyState, Panel, PanelHeader } from "./panel";

export function UpcomingItems({ itens }: { itens: ProximoItem[] }) {
  return (
    <Panel>
      <PanelHeader
        titulo="Próximos"
        subtitulo="Compromissos e tarefas com prazo à frente."
        href="/negocio/compromissos"
        hrefLabel="Compromissos"
      />

      {itens.length === 0 ? (
        <EmptyState
          titulo="Nada agendado"
          descricao="Tarefas e compromissos com prazo futuro aparecem aqui."
        />
      ) : (
        <div className="divide-y divide-border-subtle">
          {itens.map((item) => (
            <Link
              key={item.id}
              href={item.destino}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/40"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {item.titulo}
              </span>
              <span className="hidden shrink-0 text-[11px] text-muted-2 sm:inline">{item.tipo}</span>
              <span
                className={`w-[68px] shrink-0 text-right text-[11px] font-medium tabular-nums ${
                  item.dias === 0 ? "text-[color:var(--warning)]" : "text-muted"
                }`}
              >
                {item.quando}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
