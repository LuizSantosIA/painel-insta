import { Panel } from "./panel";

/** Bloco cinza discreto — mesma pulsação em toda a tela. */
function Bar({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return (
    <span
      className="block animate-pulse rounded bg-surface-2"
      style={{ width: w, height: h }}
    />
  );
}

export function MetricStripSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border-subtle bg-surface/45">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              i > 0 ? "border-t border-border-subtle" : "",
              "sm:border-t-0",
              i >= 2 ? "sm:border-t sm:border-border-subtle" : "",
              "lg:border-t-0",
              i % 2 === 1 ? "sm:border-l sm:border-border-subtle" : "",
              i > 0 ? "lg:border-l lg:border-border-subtle" : "",
            ].join(" ")}
          >
            <div className="flex flex-col gap-2.5 px-4 py-4 lg:px-5">
              <Bar w="64px" h={8} />
              <Bar w="108px" h={22} />
              <Bar w="88px" h={9} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton({ linhas = 4 }: { linhas?: number }) {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <Bar w="132px" h={12} />
        <Bar w="70px" h={10} />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: linhas }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-surface-2" />
            <Bar w={`${52 + ((i * 13) % 34)}%`} h={11} />
            <span className="ml-auto">
              <Bar w="58px" h={10} />
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Esqueleto da tela inteira, no mesmo grid do conteúdo real. */
export function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <MetricStripSkeleton />
      <PanelSkeleton linhas={5} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PanelSkeleton linhas={4} />
        <PanelSkeleton linhas={3} />
        <PanelSkeleton linhas={4} />
        <PanelSkeleton linhas={4} />
      </div>
    </div>
  );
}
