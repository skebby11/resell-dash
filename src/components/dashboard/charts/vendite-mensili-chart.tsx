"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VenditaMensile } from "@/types";
import { formatCurrencyCompact } from "@/lib/format";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: entry.color }} />
          {entry.dataKey === "numeroVendite" ? "Vendite" : "Totale"}:{" "}
          <span className="font-mono-num font-medium text-foreground">
            {entry.dataKey === "numeroVendite" ? entry.value : formatCurrencyCompact(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function VenditeMensiliChart({ data }: { data: VenditaMensile[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="meseLabel"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          allowDecimals={false}
          width={36}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: number) => formatCurrencyCompact(v)}
          width={68}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Bar
          yAxisId="left"
          dataKey="numeroVendite"
          fill="var(--chart-1)"
          radius={[5, 5, 0, 0]}
          maxBarSize={34}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="totaleVendite"
          stroke="var(--chart-2)"
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: "var(--chart-2)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
