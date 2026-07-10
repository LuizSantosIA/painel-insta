import { getAllPosts } from "@/lib/data";
import { byDayHour, formatPercent } from "@/lib/metrics";
import { HeatmapChart } from "@/components/heatmap-chart";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function HorariosPage() {
  const posts = await getAllPosts();

  if (posts.length < 5) {
    return (
      <div className="max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Melhores horários</h1>
          <p className="text-sm text-muted">Análise de engajamento por dia e horário.</p>
        </header>
        <div className="card p-8 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="font-medium">Dados insuficientes</p>
          <p className="mt-1 text-sm text-muted">
            Sincronize pelo menos 5 posts para ver a análise de horários.
          </p>
        </div>
      </div>
    );
  }

  const heatmapData = byDayHour(posts);
  const withData = heatmapData.filter((s) => s.posts > 0);
  const sorted = [...withData].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
  const top3 = sorted.slice(0, 3);
  const worst3 = sorted.slice(-3).reverse();

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Melhores horários</h1>
        <p className="text-sm text-muted">
          Engajamento médio por combinação de dia e hora — baseado em {posts.length} posts.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="font-medium text-emerald-400">Top 3 melhores horários</h2>
          </div>
          <div className="space-y-3">
            {top3.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{DAYS[s.day]}</p>
                    <p className="text-sm text-muted">
                      {String(s.hour).padStart(2, "0")}h –{" "}
                      {String(s.hour + 1).padStart(2, "0")}h
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-400">
                    {formatPercent(s.avgEngagementRate)}
                  </p>
                  <p className="text-xs text-muted">eng. médio</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-400" />
            <h2 className="font-medium text-rose-400">Top 3 piores horários</h2>
          </div>
          <div className="space-y-3">
            {worst3.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-rose-400">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{DAYS[s.day]}</p>
                    <p className="text-sm text-muted">
                      {String(s.hour).padStart(2, "0")}h –{" "}
                      {String(s.hour + 1).padStart(2, "0")}h
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-rose-400">
                    {formatPercent(s.avgEngagementRate)}
                  </p>
                  <p className="text-xs text-muted">eng. médio</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand" />
          <h2 className="font-medium">Heatmap — engajamento por dia e hora</h2>
          <span className="ml-auto text-xs text-muted">Passe o mouse sobre as células para ver detalhes</span>
        </div>
        <HeatmapChart data={heatmapData} />
      </div>
    </div>
  );
}