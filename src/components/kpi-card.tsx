import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: number;
  accentColor?: string;
}

export function KpiCard({ label, value, hint, icon: Icon, trend, accentColor }: KpiCardProps) {
  const color = accentColor ?? "#4F8CFF";
  const isPositive = trend === undefined ? null : trend >= 0;

  return (
    <div
      className="kpi-card relative overflow-hidden rounded-[20px] p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Subtle glow blob */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.12]"
        style={{ background: color, filter: "blur(40px)" }}
      />

      {/* Icon */}
      {Icon && (
        <div
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}18` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      )}

      {/* Label */}
      <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: "var(--muted)" }}>
        {label}
      </p>

      {/* Value */}
      <p className="text-[32px] font-bold tracking-tight leading-none mb-3" style={{ color: "var(--foreground)" }}>
        {value}
      </p>

      {/* Trend + hint */}
      <div className="flex items-center gap-2">
        {trend !== undefined && (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-semibold rounded-full px-2 py-0.5"
            style={
              isPositive
                ? { background: "rgba(34, 197, 94, 0.12)", color: "#22C55E" }
                : { background: "rgba(239, 68, 68, 0.12)", color: "#EF4444" }
            }
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1).replace(".", ",")}%
          </span>
        )}
        {hint && (
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
