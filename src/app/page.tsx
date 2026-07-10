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
import {
  Users,
  Images,
  Heart,
  Bookmark,
  ExternalLink,
  Zap,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
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
      {/* ─── Header ──────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Visão geral
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Desempenho da sua conta nos últimos {snapshots.length} dias
          </p>
        </div>

        <div className="flex items-center gap-3">
          {insight && (
            <div
              className="flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm"
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(79, 140, 255, 0.2)",
              }}
            >
              <Sparkles className="h-4 w-4 shrink-0" style={{ color: "#4F8CFF" }} />
              <span style={{ color: "var(--foreground-2)" }}>{insight}</span>
            </div>
          )}
          <Link
            href="/chat"
            className="btn-primary"
            style={{ whiteSpace: "nowrap" }}
          >
            <Zap className="h-4 w-4" />
            Perguntar à IA
          </Link>
        </div>
      </header>

      {/* ─── KPI Cards ───────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Seguidores"
          value={formatNumber(followers)}
          icon={Users}
          trend={followersTrend}
          hint="vs. 30 dias"
          accentColor="#4F8CFF"
        />
        <KpiCard
          label="Posts no painel"
          value={String(posts.length)}
          icon={Images}
          hint="conteúdos analisados"
          accentColor="#7C5CFF"
        />
        <KpiCard
          label="Engajamento médio"
          value={formatPercent(avgER)}
          icon={Heart}
          hint="por post"
          accentColor="#00D4FF"
        />
        <KpiCard
          label="Total de salvamentos"
          value={formatNumber(totalSaves)}
          icon={Bookmark}
          hint={`${formatNumber(totalReach)} de alcance`}
          accentColor="#22C55E"
        />
      </section>

      {/* ─── Charts ──────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                Engajamento &amp; Alcance
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                Por publicação
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#4F8CFF" }} />
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>Engajamento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#00D4FF" }} />
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>Alcance</span>
              </div>
            </div>
          </div>
          <EngagementAreaChart data={series} />
        </div>

        <div className="card p-6">
          <div className="mb-5">
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              Crescimento de seguidores
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
              Histórico do período
            </p>
          </div>
          <FollowersAreaChart data={followersSeries} />
        </div>
      </section>

      {/* ─── Bottom ──────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                Engajamento por formato
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                Média por tipo de conteúdo
              </p>
            </div>
            <Link href="/recomendacoes" className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#4F8CFF" }}>
              Ver recomendações <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <HorizontalBarChart data={byType} suffix="%" />
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                Top 5 posts
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                Maior engajamento do período
              </p>
            </div>
            <Link href="/posts" className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#4F8CFF" }}>
              Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="space-y-2">
            {top.map((p, i) => (
              <li key={p.id} className="post-row flex items-center gap-3 rounded-[12px] px-3 py-2.5">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={
                    i === 0
                      ? { background: "linear-gradient(135deg, #4F8CFF, #7C5CFF)", color: "white" }
                      : { background: "var(--surface-2)", color: "var(--muted)" }
                  }
                >
                  {i + 1}
                </span>
                <PostThumb type={p.mediaType} url={p.thumbnailUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                    {p.caption ?? "Sem legenda"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <MediaBadge type={p.mediaType} />
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {formatPercent(engagementRate(p))}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {formatNumber(engagement(p))}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>interações</p>
                </div>
                {p.permalink && (
                  <a href={p.permalink} target="_blank" rel="noreferrer" style={{ color: "var(--muted-2)" }}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
            {top.length === 0 && (
              <li className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
                Sincronize posts para ver o ranking.
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
