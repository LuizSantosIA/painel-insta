// Cálculos de métricas e agregações — funções puras, sem dependência do banco.

export interface PostLike {
  id: string;
  igId?: string | null;
  caption: string | null;
  mediaType: string;
  category: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  postedAt: Date;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  videoViews: number;
  followersAtPost: number;
}

/** Total de interações (curtidas + comentários + salvamentos + compartilhamentos). */
export function engagement(p: PostLike): number {
  return p.likes + p.comments + p.saves + p.shares;
}

/** Taxa de engajamento em %. Usa alcance quando disponível, senão seguidores. */
export function engagementRate(p: PostLike): number {
  const base = p.reach > 0 ? p.reach : p.followersAtPost;
  if (!base) return 0;
  return (engagement(p) / base) * 100;
}

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("pt-BR");
}

export function formatPercent(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",") + "%";
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export interface GroupStats {
  key: string;
  count: number;
  totalEngagement: number;
  avgEngagement: number;
  avgEngagementRate: number;
  avgReach: number;
  avgSaves: number;
}

function groupStats(key: string, posts: PostLike[]): GroupStats {
  return {
    key,
    count: posts.length,
    totalEngagement: posts.reduce((s, p) => s + engagement(p), 0),
    avgEngagement: avg(posts.map(engagement)),
    avgEngagementRate: avg(posts.map(engagementRate)),
    avgReach: avg(posts.map((p) => p.reach)),
    avgSaves: avg(posts.map((p) => p.saves)),
  };
}

/** Agrupa por um campo (mediaType ou category) e calcula médias. */
export function aggregateBy(
  posts: PostLike[],
  field: "mediaType" | "category"
): GroupStats[] {
  const groups = new Map<string, PostLike[]>();
  for (const p of posts) {
    const k = (p[field] ?? "Sem categoria") as string;
    const arr = groups.get(k) ?? [];
    arr.push(p);
    groups.set(k, arr);
  }
  return [...groups.entries()]
    .map(([k, arr]) => groupStats(k, arr))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export interface TimePoint {
  label: string;
  date: string;
  engagement: number;
  reach: number;
  posts: number;
}

/** Série temporal agregada por dia (YYYY-MM-DD). */
export function dailySeries(posts: PostLike[]): TimePoint[] {
  const map = new Map<string, { engagement: number; reach: number; posts: number }>();
  for (const p of posts) {
    const d = p.postedAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const cur = map.get(key) ?? { engagement: 0, reach: 0, posts: 0 };
    cur.engagement += engagement(p);
    cur.reach += p.reach;
    cur.posts += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [, m, day] = key.split("-");
      return {
        date: key,
        label: `${day}/${m}`,
        engagement: v.engagement,
        reach: v.reach,
        posts: v.posts,
      };
    });
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface WeekdayStat {
  weekday: string;
  index: number;
  avgEngagementRate: number;
  posts: number;
}

/** Engajamento médio por dia da semana (para descobrir o melhor dia de postar). */
export function byWeekday(posts: PostLike[]): WeekdayStat[] {
  const buckets: PostLike[][] = Array.from({ length: 7 }, () => []);
  for (const p of posts) buckets[p.postedAt.getDay()].push(p);
  return buckets.map((arr, i) => ({
    weekday: WEEKDAYS[i],
    index: i,
    avgEngagementRate: avg(arr.map(engagementRate)),
    posts: arr.length,
  }));
}

export interface HourStat {
  hour: number;
  label: string;
  avgEngagementRate: number;
  posts: number;
}

/** Engajamento médio por faixa de horário do dia. */
export function byHour(posts: PostLike[]): HourStat[] {
  const buckets: PostLike[][] = Array.from({ length: 24 }, () => []);
  for (const p of posts) buckets[p.postedAt.getHours()].push(p);
  return buckets.map((arr, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}h`,
    avgEngagementRate: avg(arr.map(engagementRate)),
    posts: arr.length,
  }));
}

/** Ordena posts por uma métrica e retorna os N primeiros. */
export type RankMetric =
  | "engagement"
  | "engagementRate"
  | "reach"
  | "likes"
  | "comments"
  | "saves";

export function metricValue(p: PostLike, metric: RankMetric): number {
  switch (metric) {
    case "engagement":
      return engagement(p);
    case "engagementRate":
      return engagementRate(p);
    case "reach":
      return p.reach;
    case "likes":
      return p.likes;
    case "comments":
      return p.comments;
    case "saves":
      return p.saves;
  }
}

export function rankPosts(
  posts: PostLike[],
  metric: RankMetric,
  limit?: number
): PostLike[] {
  const sorted = [...posts].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  return limit ? sorted.slice(0, limit) : sorted;
}

export interface DayHourStat {
  day: number;
  hour: number;
  avgEngagement: number;
  avgEngagementRate: number;
  posts: number;
}

export function byDayHour(posts: PostLike[]): DayHourStat[] {
  const buckets: PostLike[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => [])
  );
  for (const p of posts) {
    buckets[p.postedAt.getDay()][p.postedAt.getHours()].push(p);
  }
  const result: DayHourStat[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const arr = buckets[d][h];
      const n = arr.length;
      result.push({
        day: d,
        hour: h,
        avgEngagement: n > 0 ? arr.reduce((s, p) => s + engagement(p), 0) / n : 0,
        avgEngagementRate: n > 0 ? arr.reduce((s, p) => s + engagementRate(p), 0) / n : 0,
        posts: n,
      });
    }
  }
  return result;
}