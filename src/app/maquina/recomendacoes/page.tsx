import { getAllPosts } from "@/lib/data";
import {
  aggregateBy,
  byHour,
  byWeekday,
  formatPercent,
} from "@/lib/metrics";
import { buildRecommendations } from "@/lib/recommendations";
import { VerticalBarChart } from "@/components/charts";
import { Sparkles, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const IMPACT_STYLES: Record<string, string> = {
  alto: "bg-emerald-500/15 text-emerald-400",
  médio: "bg-amber-500/15 text-amber-400",
  baixo: "bg-sky-500/15 text-sky-400",
};

export default async function RecommendationsPage() {
  const posts = await getAllPosts();
  const recs = buildRecommendations(posts);

  const byCat = aggregateBy(
    posts.filter((p) => p.category),
    "category"
  );

  const weekdayData = byWeekday(posts).map((d) => ({
    label: d.weekday,
    value: d.avgEngagementRate,
  }));

  const bestHours = byHour(posts)
    .filter((h) => h.posts > 0)
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Recomendações</h1>
        <p className="text-sm text-muted">
          Sugestões geradas a partir do seu histórico para trabalhar o algoritmo.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {recs.map((r, i) => (
          <div key={i} className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                <h3 className="font-medium">{r.title}</h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  IMPACT_STYLES[r.impact] ?? ""
                }`}
              >
                impacto {r.impact}
              </span>
            </div>
            <p className="text-sm text-muted">{r.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-medium text-muted">
            Engajamento médio por dia da semana
          </h2>
          <VerticalBarChart data={weekdayData} suffix="%" />
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-medium text-muted">
            Melhores horários para postar
          </h2>
          <ul className="space-y-3">
            {bestHours.map((h) => (
              <li key={h.hour} className="flex items-center gap-3">
                <span className="w-12 font-mono text-sm">{h.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="brand-gradient h-full rounded-full"
                    style={{
                      width: `${
                        (h.avgEngagementRate / (bestHours[0]?.avgEngagementRate || 1)) * 100
                      }%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right text-sm text-muted">
                  {formatPercent(h.avgEngagementRate)}
                </span>
              </li>
            ))}
            {bestHours.length === 0 && (
              <p className="text-sm text-muted">Sem dados suficientes ainda.</p>
            )}
          </ul>
        </div>
      </section>

      {byCat.length > 0 && (
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-medium text-muted">
              Ranking de temas por desempenho
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Tema</th>
                  <th className="px-3 py-2 font-medium">Posts</th>
                  <th className="px-3 py-2 font-medium">Eng. médio</th>
                  <th className="px-3 py-2 font-medium">Alcance médio</th>
                  <th className="px-3 py-2 font-medium">Salvos médios</th>
                </tr>
              </thead>
              <tbody>
                {byCat.map((g, i) => (
                  <tr key={g.key} className="border-b border-border/60">
                    <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{g.key}</td>
                    <td className="px-3 py-2.5">{g.count}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-brand/15 px-2 py-1 text-xs font-medium text-brand">
                        {formatPercent(g.avgEngagementRate)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {Math.round(g.avgReach).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5">
                      {Math.round(g.avgSaves).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}