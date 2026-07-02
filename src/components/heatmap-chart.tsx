"use client";

import type { DayHourStat } from "@/lib/metrics";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function interpolateColor(t: number): string {
  const r = Math.round(21 + t * (37 - 21));
  const g = Math.round(21 + t * (99 - 21));
  const b = Math.round(29 + t * (235 - 29));
  return `rgb(${r},${g},${b})`;
}

export function HeatmapChart({ data }: { data: DayHourStat[] }) {
  const maxRate = Math.max(...data.map((d) => d.avgEngagementRate), 0.001);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 680 }}>
        <div className="mb-1 flex" style={{ marginLeft: 40 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="flex-1 text-center text-[10px] text-muted"
              style={{ minWidth: 22 }}
            >
              {h % 3 === 0 ? `${String(h).padStart(2, "0")}h` : ""}
            </div>
          ))}
        </div>

        {DAYS.map((day, d) => (
          <div key={d} className="mb-1 flex items-center gap-0.5">
            <div className="w-9 shrink-0 pr-1 text-right text-xs text-muted">{day}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const stat = data.find((s) => s.day === d && s.hour === h);
              const norm = stat && stat.posts > 0 ? stat.avgEngagementRate / maxRate : 0;
              const bg = norm > 0 ? interpolateColor(norm) : "#0e1628";
              const title = stat && stat.posts > 0
                ? `${day} ${String(h).padStart(2, "0")}h — eng. médio: ${stat.avgEngagementRate.toFixed(2).replace(".", ",")}% (${stat.posts} post${stat.posts > 1 ? "s" : ""})`
                : `${day} ${String(h).padStart(2, "0")}h — sem dados`;
              return (
                <div
                  key={h}
                  className="flex-1 rounded-sm"
                  style={{ minWidth: 22, height: 26, backgroundColor: bg, border: "1px solid #1e3058" }}
                  title={title}
                />
              );
            })}
          </div>
        ))}

        <div className="ml-10 mt-3 flex items-center gap-2">
          <span className="text-xs text-muted">Menos</span>
          <div className="flex gap-0.5">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
              <div
                key={v}
                className="h-4 w-6 rounded-sm"
                style={{ backgroundColor: v === 0 ? "#0e1628" : interpolateColor(v) }}
              />
            ))}
          </div>
          <span className="text-xs text-muted">Mais engajamento</span>
        </div>
      </div>
    </div>
  );
}