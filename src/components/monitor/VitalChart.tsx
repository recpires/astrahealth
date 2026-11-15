"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REFERENCE_CONFIG, formatVital } from "@/config/reference-ranges";
import { classifyValue } from "@/lib/analysis/engine";
import { formatClock } from "@/lib/time";
import type { VitalKey } from "@/lib/types";

export interface ChartPoint {
  t: number;
  value: number | null;
}

const LEVEL_HEX = { NOMINAL: "#34d399", ADVISORY: "#38bdf8", CAUTION: "#fbbf24", WARNING: "#f43f5e" } as const;

const Y_TICKS: Record<VitalKey, number[]> = {
  hr: [30, 60, 90, 120, 150],
  spo2: [60, 70, 80, 90, 100],
  temp: [34, 36, 38, 40],
};

export function VitalChart({
  vital,
  data,
  excluded,
  suspect,
  height,
  className,
}: {
  vital: VitalKey;
  data: ChartPoint[];
  excluded?: boolean;
  /** Sensor is suspect: out-of-range points are drawn in the sensor colour, not as alerts. */
  suspect?: boolean;
  /** Fixed height in px; omit to fill the parent (which must have a definite height). */
  height?: number;
  className?: string;
}) {
  const vc = REFERENCE_CONFIG.vitals[vital];
  const stroke = excluded ? "#a78bfa" : "#22d3ee";
  return (
    <div style={height ? { height } : undefined} className={className ?? "h-full w-full"} aria-label={`${vc.label} trend chart (simulated data)`} role="img">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: height ?? 160 }}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#1a3159" strokeDasharray="2 4" vertical={false} />
          <ReferenceArea y1={vc.normal[0]} y2={vc.normal[1]} fill="#34d399" fillOpacity={0.07} stroke="none" ifOverflow="hidden" />
          {vc.caution[0] > vc.chartDomain[0] && (
            <ReferenceLine y={vc.caution[0]} stroke="#f43f5e" strokeOpacity={0.5} strokeDasharray="4 4" ifOverflow="hidden" />
          )}
          {vc.caution[1] < vc.chartDomain[1] && (
            <ReferenceLine y={vc.caution[1]} stroke="#f43f5e" strokeOpacity={0.5} strokeDasharray="4 4" ifOverflow="hidden" />
          )}
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatClock}
            tick={{ fill: "#7a8fb3", fontSize: 10 }}
            stroke="#1a3159"
            tickCount={5}
          />
          <YAxis domain={vc.chartDomain} ticks={Y_TICKS[vital]} tick={{ fill: "#7a8fb3", fontSize: 10 }} stroke="#1a3159" width={44} allowDataOverflow />
          <Tooltip
            contentStyle={{ background: "#071226", border: "1px solid #24427a", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#93a8c9" }}
            itemStyle={{ color: "#e6f1ff" }}
            labelFormatter={(t) => `MET ${formatClock(Number(t))}`}
            formatter={(v) => [`${formatVital(vital, v as number)} ${vc.unit}`, `${vc.shortLabel} (simulated)`]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray={excluded ? "4 3" : undefined}
            connectNulls={false}
            isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number; payload?: ChartPoint }) => {
              const v = p.payload?.value;
              const key = `dot-${p.index}`;
              if (v === null || v === undefined || p.cx === undefined || p.cy === undefined) return <g key={key} />;
              const c = classifyValue(vital, v);
              if (c.level === "NOMINAL") return <g key={key} />;
              return <circle key={key} cx={p.cx} cy={p.cy} r={2.4} fill={excluded || suspect ? "#a78bfa" : LEVEL_HEX[c.level]} />;
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
