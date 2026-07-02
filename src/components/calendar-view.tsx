"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Heart, MessageCircle, Bookmark, Eye, Share2, ExternalLink } from "lucide-react";
import { MediaBadge, PostThumb } from "@/components/post-media";
import { mediaTypeColor } from "@/lib/constants";

export interface CalendarPost {
  id: string;
  caption: string | null;
  mediaType: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  postedAt: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  engagement: number;
  engagementRate: number;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isoToDate(iso: string): Date {
  return new Date(iso);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ posts }: { posts: CalendarPost[] }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState<CalendarPost | null>(null);
  const [todayKey, setTodayKey] = useState("");

  useEffect(() => {
    setTodayKey(dateKey(new Date()));
  }, []);

  const postsByDay = new Map<string, CalendarPost[]>();
  for (const p of posts) {
    const d = isoToDate(p.postedAt);
    const key = dateKey(d);
    const arr = postsByDay.get(key) ?? [];
    arr.push(p);
    postsByDay.set(key, arr);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstWd = getFirstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array(firstWd).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="relative">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <button
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-2.5 text-center text-xs font-medium text-muted">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[90px] border-b border-r border-border/50 bg-surface-2/20 p-1.5"
                />
              );
            }
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = key === todayKey;

            return (
              <div
                key={day}
                className={`min-h-[90px] border-b border-r border-border/50 p-1.5 ${
                  dayPosts.length === 0 ? "bg-surface-2/10" : ""
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "brand-gradient font-semibold text-white"
                        : "text-muted"
                    }`}
                  >
                    {day}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                      {dayPosts.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 2).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface-2"
                      style={{ borderLeft: `2px solid ${mediaTypeColor(p.mediaType)}` }}
                    >
                      <PostThumb type={p.mediaType} url={p.thumbnailUrl} size={20} />
                      <span className="truncate text-[10px] text-muted">
                        {p.caption?.slice(0, 24) ?? "Sem legenda"}
                      </span>
                    </button>
                  ))}
                  {dayPosts.length > 2 && (
                    <button
                      onClick={() => setSelected(dayPosts[2])}
                      className="text-[10px] text-muted hover:text-foreground"
                    >
                      +{dayPosts.length - 2} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        {[
          { type: "REELS", label: "Reel" },
          { type: "CAROUSEL_ALBUM", label: "Carrossel" },
          { type: "IMAGE", label: "Foto" },
          { type: "VIDEO", label: "Vídeo" },
        ].map((t) => (
          <span key={t.type} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: mediaTypeColor(t.type) }}
            />
            {t.label}
          </span>
        ))}
        <span className="ml-auto">Dias sem post têm fundo mais escuro</span>
      </div>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelected(null)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <MediaBadge type={selected.mediaType} />
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-start gap-3">
                <PostThumb type={selected.mediaType} url={selected.thumbnailUrl} size={64} />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed">
                    {selected.caption ?? "Sem legenda"}
                  </p>
                  <p className="mt-1.5 text-xs text-muted">
                    {new Date(selected.postedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Heart, label: "Curtidas", value: fmt(selected.likes), color: "text-rose-400" },
                  { icon: MessageCircle, label: "Comentários", value: fmt(selected.comments), color: "text-blue-400" },
                  { icon: Bookmark, label: "Salvamentos", value: fmt(selected.saves), color: "text-amber-400" },
                  { icon: Share2, label: "Compartilhamentos", value: fmt(selected.shares), color: "text-emerald-400" },
                  { icon: Eye, label: "Alcance", value: fmt(selected.reach), color: "text-purple-400" },
                  { icon: Heart, label: "Interações", value: fmt(selected.engagement), color: "text-brand" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-surface-2 p-3">
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                    <p className="mt-1.5 text-lg font-semibold">{m.value}</p>
                    <p className="text-xs text-muted">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-surface-2/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Taxa de engajamento</span>
                  <span className="rounded-md bg-brand/15 px-2.5 py-1 text-sm font-semibold text-brand">
                    {selected.engagementRate.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
              </div>

              {selected.permalink && (
                <a
                  href={selected.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm text-muted hover:border-brand hover:text-brand transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver no Instagram
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}