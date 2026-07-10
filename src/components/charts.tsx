"use client";

import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

const AXIS_STYLE = { stroke: "#4a617f", fontSize: 11, fontFamily: "var(--font-sans)" };
const GRID_COLOR = "#1a2847";

const TooltipContainer = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(79, 140, 255, 0.2)",
        borderRadius: 14,
        padding: "12px 16px",
        boxShadow: "0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(79, 140, 255, 0.1)",
        backdropFilter: "blur(20px)",
        minWidth: 140,
      }}
    >
      {label && (
        <p style={{ color: "#6b82a8", fontSize: 11, marginBottom: 8, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2" style={{ marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: entry.color,
              boxShadow: `0 0 6px ${entry.color}`,
            }}
          />
          <span style={{ color: "#6b82a8", fontSize: 12 }}>{entry.name}</span>
          <span style={{ color: "#f1f5ff", fontSize: 13, fontWeight: 600, marginLeft: "auto", paddingLeft: 8 }}>
            {Number(entry.value).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
};

export interface SeriePoint {
  label: string;
  engagement: number;
  reach: number;
}

export function EngagementAreaChart({ data }: { data: SeriePoint[] }) {
  const mounted = useMounted();
  if (!mounted)
    return (
      <div
        style={{ height: 280, background: "var(--surface-2)" }}
        className="rounded-2xl animate-pulse"
      />
    );
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 12, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gEng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity={0.4} />
            <stop offset="80%" stopColor="#4F8CFF" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gReach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
            <stop offset="80%" stopColor="#00D4FF" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="0"
          stroke={GRID_COLOR}
          vertical={false}
          strokeOpacity={0.6}
        />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip content={<TooltipContainer />} />
        <Area
          type="monotone"
          dataKey="reach"
          name="Alcance"
          stroke="#00D4FF"
          strokeWidth={2}
          fill="url(#gReach)"
          dot={false}
          activeDot={{ r: 5, fill: "#00D4FF", stroke: "#060B16", strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="engagement"
          name="Engajamento"
          stroke="#4F8CFF"
          strokeWidth={2}
          fill="url(#gEng)"
          dot={false}
          activeDot={{ r: 5, fill: "#4F8CFF", stroke: "#060B16", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface FollowersPoint {
  label: string;
  followers: number;
}

export function FollowersAreaChart({ data }: { data: FollowersPoint[] }) {
  const mounted = useMounted();
  if (!mounted)
    return <div style={{ height: 240 }} className="rounded-2xl animate-pulse" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 12, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gFoll" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.4} />
            <stop offset="80%" stopColor="#7C5CFF" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={[(d: number) => Math.max(0, d - 100), (d: number) => d + 100]}
        />
        <Tooltip content={<TooltipContainer />} />
        <Area
          type="monotone"
          dataKey="followers"
          name="Seguidores"
          stroke="#7C5CFF"
          strokeWidth={2}
          fill="url(#gFoll)"
          dot={false}
          activeDot={{ r: 5, fill: "#7C5CFF", stroke: "#060B16", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface BarPoint {
  label: string;
  value: number;
  color?: string;
}

export function HorizontalBarChart({
  data,
  suffix = "",
}: {
  data: BarPoint[];
  suffix?: string;
}) {
  const mounted = useMounted();
  if (!mounted)
    return (
      <div
        style={{ height: Math.max(180, data.length * 46) }}
        className="rounded-2xl animate-pulse"
      />
    );

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(79, 140, 255, 0.2)",
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          color: "#f1f5ff",
          fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {Number(payload[0].value).toFixed(2).replace(".", ",")}
        {suffix}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} horizontal={false} strokeOpacity={0.6} />
        <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 140, 255, 0.05)", radius: 8 }} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? "#4F8CFF"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VerticalBarChart({
  data,
  suffix = "",
}: {
  data: BarPoint[];
  suffix?: string;
}) {
  const mounted = useMounted();
  if (!mounted)
    return <div style={{ height: 240 }} className="rounded-2xl animate-pulse" />;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(79, 140, 255, 0.2)",
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          color: "#f1f5ff",
          fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {Number(payload[0].value).toFixed(2).replace(".", ",")}
        {suffix}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} strokeOpacity={0.6} />
        <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 140, 255, 0.05)", radius: 8 }} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={32}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? "#7C5CFF"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
