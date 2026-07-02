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

const AXIS = { stroke: "#9b9bb0", fontSize: 12 };
const GRID = "#1e3058";

const tooltipStyle = {
  background: "#162038",
  border: "1px solid #1e3058",
  borderRadius: 12,
  color: "#e8edf8",
  fontSize: 13,
};

export interface SeriePoint {
  label: string;
  engagement: number;
  reach: number;
}

export function EngagementAreaChart({ data }: { data: SeriePoint[] }) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height: 280 }} className="animate-pulse rounded-lg bg-surface-2" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gEng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gReach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#56ccf2" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#56ccf2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="reach"
          name="Alcance"
          stroke="#56ccf2"
          fill="url(#gReach)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="engagement"
          name="Engajamento"
          stroke="#2563EB"
          fill="url(#gEng)"
          strokeWidth={2}
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
  if (!mounted) return <div style={{ height: 240 }} className="animate-pulse rounded-lg bg-surface-2" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gFoll" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4338CA" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#4338CA" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} domain={[(d: number) => Math.max(0, d - 100), (d: number) => d + 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="followers"
          name="Seguidores"
          stroke="#4338CA"
          fill="url(#gFoll)"
          strokeWidth={2}
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
  if (!mounted) return <div style={{ height: Math.max(180, data.length * 46) }} className="animate-pulse rounded-lg bg-surface-2" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `${Number(value).toFixed(2).replace(".", ",")}${suffix}`,
            "Engajamento",
          ]}
          cursor={{ fill: "#ffffff08" }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? "#2563EB"} />
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
  if (!mounted) return <div style={{ height: 240 }} className="animate-pulse rounded-lg bg-surface-2" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [
            `${Number(value).toFixed(2).replace(".", ",")}${suffix}`,
            "Engajamento",
          ]}
          cursor={{ fill: "#ffffff08" }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? "#4338CA"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}