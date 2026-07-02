"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Search } from "lucide-react";
import { MediaBadge, PostThumb } from "@/components/post-media";
import {
  DEFAULT_CATEGORIES,
  MEDIA_TYPES,
  mediaTypeLabel,
} from "@/lib/constants";

export interface PostRow {
  id: string;
  caption: string | null;
  mediaType: string;
  category: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  postedAt: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  videoViews: number;
  engagement: number;
  engagementRate: number;
}

type SortKey =
  | "postedAt"
  | "reach"
  | "impressions"
  | "videoViews"
  | "likes"
  | "comments"
  | "saves"
  | "engagement"
  | "engagementRate";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "postedAt", label: "Data" },
  { key: "videoViews", label: "Visualizações" },
  { key: "reach", label: "Alcance" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Coment." },
  { key: "saves", label: "Salvos" },
  { key: "engagement", label: "Interações" },
  { key: "engagementRate", label: "Eng. %" },
];

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function PostsTable({ initial }: { initial: PostRow[] }) {
  const [rows, setRows] = useState(initial);
  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [asc, setAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    let list = rows;
    if (typeFilter !== "ALL") list = list.filter((r) => r.mediaType === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.caption?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = sortKey === "postedAt" ? new Date(a.postedAt).getTime() : a[sortKey];
      const bv = sortKey === "postedAt" ? new Date(b.postedAt).getTime() : b[sortKey];
      return asc ? av - bv : bv - av;
    });
  }, [rows, sortKey, asc, typeFilter, query]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  async function updateCategory(id: string, category: string) {
    setSavingId(id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, category } : r)));
    try {
      await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={typeFilter === "ALL"} onClick={() => setTypeFilter("ALL")}>
            Todos
          </FilterChip>
          {MEDIA_TYPES.filter((t) => rows.some((r) => r.mediaType === t)).map((t) => (
            <FilterChip
              key={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            >
              {mediaTypeLabel(t)}
            </FilterChip>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar legenda ou tema..."
            className="w-64 rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Post</th>
              <th className="px-3 py-3 font-medium">Tema</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-3 font-medium">
                  <button
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {c.label}
                    {sortKey === c.key &&
                      (asc ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </button>
                </th>
              ))}
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-border/60 hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PostThumb type={p.mediaType} url={p.thumbnailUrl} size={40} />
                    <div className="min-w-0 max-w-[260px]">
                      <p className="truncate">{p.caption ?? "Sem legenda"}</p>
                      <div className="mt-1">
                        <MediaBadge type={p.mediaType} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={p.category ?? ""}
                    onChange={(e) => updateCategory(p.id, e.target.value)}
                    disabled={savingId === p.id}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-brand"
                  >
                    <option value="">—</option>
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {p.category && !DEFAULT_CATEGORIES.includes(p.category as never) && (
                      <option value={p.category}>{p.category}</option>
                    )}
                  </select>
                </td>
                <td className="px-3 py-3 text-muted">{fmtDate(p.postedAt)}</td>
                <td className="px-3 py-3">
                  {fmt(p.videoViews > 0 ? p.videoViews : p.impressions)}
                </td>
                <td className="px-3 py-3">{fmt(p.reach)}</td>
                <td className="px-3 py-3">{fmt(p.likes)}</td>
                <td className="px-3 py-3">{fmt(p.comments)}</td>
                <td className="px-3 py-3">{fmt(p.saves)}</td>
                <td className="px-3 py-3 font-medium">{fmt(p.engagement)}</td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-brand/15 px-2 py-1 text-xs font-medium text-brand">
                    {p.engagementRate.toFixed(1).replace(".", ",")}%
                  </span>
                </td>
                <td className="px-3 py-3">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Nenhum post encontrado com esse filtro.
          </p>
        )}
      </div>
      <p className="text-xs text-muted">{sorted.length} posts</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}