"use client";

import { useMemo, useState } from "react";
import { Hash, ArrowDown, ArrowUp } from "lucide-react";
import type { PostRow } from "@/components/posts-table";

interface HashtagStat {
  tag: string;
  count: number;
  avgLikes: number;
  avgReach: number;
  avgEngagementRate: number;
}

function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  const matches = caption.match(/#[\wÀ-ɏЀ-ӿ]+/g) ?? [];
  return matches.map((t) => t.toLowerCase());
}

type SortKey = "count" | "avgLikes" | "avgReach" | "avgEngagementRate";

export function HashtagTable({ posts }: { posts: PostRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("avgEngagementRate");
  const [asc, setAsc] = useState(false);

  const stats = useMemo<HashtagStat[]>(() => {
    const map = new Map<string, PostRow[]>();
    for (const p of posts) {
      for (const tag of extractHashtags(p.caption)) {
        const arr = map.get(tag) ?? [];
        arr.push(p);
        map.set(tag, arr);
      }
    }
    return [...map.entries()].map(([tag, arr]) => ({
      tag,
      count: arr.length,
      avgLikes: arr.reduce((s, p) => s + p.likes, 0) / arr.length,
      avgReach: arr.reduce((s, p) => s + p.reach, 0) / arr.length,
      avgEngagementRate: arr.reduce((s, p) => s + p.engagementRate, 0) / arr.length,
    }));
  }, [posts]);

  const sorted = useMemo(() => {
    return [...stats].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return asc ? diff : -diff;
    });
  }, [stats, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else { setSortKey(key); setAsc(false); }
  }

  function fmt(n: number): string {
    return Math.round(n).toLocaleString("pt-BR");
  }

  const top5 = new Set(
    [...stats].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate).slice(0, 5).map((s) => s.tag)
  );

  if (stats.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        Nenhuma hashtag encontrada nas legendas dos posts sincronizados.
      </div>
    );
  }

  const COLS: { key: SortKey; label: string }[] = [
    { key: "count", label: "Usos" },
    { key: "avgLikes", label: "Curtidas médias" },
    { key: "avgReach", label: "Alcance médio" },
    { key: "avgEngagementRate", label: "Eng. médio %" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-brand" />
          <span className="font-medium">Análise de hashtags</span>
        </div>
        <span className="text-sm text-muted">{stats.length} hashtags encontradas</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Hashtag</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-3 font-medium">
                  <button
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    {sortKey === c.key && (
                      asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.tag} className="border-b border-border/60 hover:bg-surface-2/40">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{s.tag}</span>
                    {top5.has(s.tag) && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        top 5
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted">{s.count}</td>
                <td className="px-3 py-2.5">{fmt(s.avgLikes)}</td>
                <td className="px-3 py-2.5">{fmt(s.avgReach)}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-md bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
                    {s.avgEngagementRate.toFixed(1).replace(".", ",")}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Ordenado por melhor desempenho. Top 5 destacadas em verde.</p>
    </div>
  );
}