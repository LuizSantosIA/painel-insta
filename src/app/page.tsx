import { getAllPosts, getAccountSnapshots } from "@/lib/data";
import { fetchFollowersCount } from "@/lib/instagram";
import {
  aggregateBy,
  dailySeries,
  engagement,
  engagementRate,
  formatNumber,
  formatPercent,
  rankPosts,
} from "@/lib/metrics";
import { headlineInsight } from "@/lib/recommendations";
import { mediaTypeColor, mediaTypeLabel } from "@/lib/constants";
import { KpiCard } from "@/components/kpi-card";
import {
  EngagementAreaChart,
  FollowersAreaChart,
  HorizontalBarChart,
} from "@/components/charts";
import { MediaBadge, PostThumb } from "@/components/post-media";
import { Users, Images, Heart, Bookmark, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [posts, snapshots, liveFollowers] = await Promise.all([
    getAllPosts(),
    getAccountSnapshots(),
    fetchFollowersCount(),
  ]);

  const totalReach = posts.reduce((s, p) => s + p.reach, 0);
  const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
  const avgER =
    posts.length > 0
      ? posts.reduce((s, p) => s + engagementRate(p), 0) / posts.length
      : 0;

  const latest = snapshots[snapshots.length - 1];
  const prev30 = snapshots[Math.max(0, snapshots.length - 31)];
  const followers = liveFollowers ?? latest?.followers ?? 0;
  const followersTrend =
    prev30 && prev30.followers > 0
      ? ((followers - prev30.followers) / prev30.followers) * 100
      : undefined;

  const series = dailySeries(posts);
  const followersSeries = snapshots.map((s) => ({
    label: `${String(s.date.getDate()).padStart(2, "0")}/${String(
      s.date.getMonth() + 1
    ).padStart(2, "0")}`,
    followers: s.followers,
  }));

  const byType = aggregateBy(posts, "mediaType").map((g) => ({
    label: mediaTypeLabel(g.key),
    value: g.avgEngagementRate,
    color: mediaTypeColor(g.key),
  }));

  const top = rankPosts(posts, "engagement", 5);
  const insight = headlineInsight(posts);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted">
            Desempenho da sua conta nos últimos {snapshots.length} dias
          </p>
        </div>
        {insight && (
          <div className="card flex items-center gap-2 px-4 py-2.5 text-sm">
            <Sparkles className="h-4 w-4 text-brand" />
            <span>{insight}</span>
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Seguidores"
          value={formatNumber(followers)}
          icon={Users}
          trend={followersTrend}
          hint="vs. 30 dias"
        />
        <KpiCard
          label="Posts no painel"
          value={String(posts.length)}
          icon={Images}
          hint="conteúdos analisados"
        />
        <KpiCard
          label="Engajamento médio"
          value={formatPercent(avgER)}
          icon={Heart}
          hint="por post"
        />
        <KpiCard
          label="Total de salvamentos"
          value={formatNumber(totalSaves)}
          icon={Bookmark}
          hint={`${formatNumber(totalReach)} de alcance`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-muted">
            Engajamento e alcance por publicação
          </h2>
          <EngagementAreaChart data={series} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-medium text-muted">
            Crescimento de seguidores
          </h2>
          <FollowersAreaChart data={followersSeries} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">
              Engajamento médio por tipo de conteúdo
            </h2>
            <Link
              href="/recomendacoes"
              className="text-xs text-brand hover:underline"
            >
              Ver recomendações
            </Link>
          </div>
          <HorizontalBarChart data={byType} suffix="%" />
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">Top 5 posts</h2>
            <Link href="/posts" className="text-xs text-brand hover:underline">
              Ver todos
            </Link>
          </div>
          <ul className="space-y-3">
            {top.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-4 text-sm font-semibold text-muted">{i + 1}</span>
                <PostThumb type={p.mediaType} url={p.thumbnailUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.caption ?? "Sem legenda"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <MediaBadge type={p.mediaType} />
                    <span className="text-xs text-muted">
                      {formatPercent(engagementRate(p))} eng.
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatNumber(engagement(p))}</p>
                  <p className="text-xs text-muted">interações</p>
                </div>
                {p.permalink && (
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}