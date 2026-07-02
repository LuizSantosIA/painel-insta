import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: number; // variação em %, opcional
}

export function KpiCard({ label, value, hint, icon: Icon, trend }: KpiCardProps) {
  const trendColor =
    trend === undefined ? "" : trend >= 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend !== undefined && (
          <span className={trendColor}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1).replace(".", ",")}%
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </div>
  );
}