/** Bloco cinza discreto — mesma pulsação em toda a tela. */
function Bar({ w = "100%", h = 11 }: { w?: string; h?: number }) {
  return <span className="block animate-pulse rounded bg-surface-2" style={{ width: w, height: h }} />;
}

export function MetricStripSkeleton() {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface/40">
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
            <div className="flex flex-col justify-between gap-2 px-4 py-3.5 lg:px-5">
              <Bar w="62px" h={8} />
              <span className="flex h-[27px] items-end">
                <Bar w="104px" h={20} />
              </span>
              <span className="flex h-[15px] items-center">
                <Bar w="86px" h={9} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Seção sem caixa, no mesmo ritmo do conteúdo real. */
export function SectionSkeleton({ linhas = 4 }: { linhas?: number }) {
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-1.5">
        <Bar w="124px" h={12} />
        <Bar w="64px" h={10} />
      </div>
      <div className="divide-y divide-border-subtle/70">
        {Array.from({ length: linhas }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 py-[9px]">
            <span className="h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-surface-2" />
            <Bar w={`${48 + ((i * 13) % 32)}%`} h={10} />
            <span className="ml-auto">
              <Bar w="54px" h={9} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Esqueleto da tela inteira, no mesmo grid do conteúdo real. */
export function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <MetricStripSkeleton />
      <SectionSkeleton linhas={4} />
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
        <SectionSkeleton linhas={4} />
        <SectionSkeleton linhas={4} />
        <SectionSkeleton linhas={3} />
        <SectionSkeleton linhas={3} />
      </div>
    </div>
  );
}
