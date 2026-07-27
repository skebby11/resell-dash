"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DistribuzioneVoce } from "@/types";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { total: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const pct = entry.payload.total > 0 ? ((entry.value / entry.payload.total) * 100).toFixed(0) : "0";
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{entry.name}</p>
      <p className="text-muted-foreground">
        <span className="font-mono-num font-medium text-foreground">{entry.value}</span> vendite ·{" "}
        {pct}%
      </p>
    </div>
  );
}

export function DistribuzioneDonut({ data }: { data: DistribuzioneVoce[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const dataWithTotal = data.map((d) => ({ ...d, total }));

  if (total === 0) {
    return (
      <div className="flex h-[168px] w-full items-center justify-center text-sm text-muted-foreground">
        Nessun dato
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataWithTotal}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              strokeWidth={0}
            >
              {dataWithTotal.map((entry, i) => (
                <Cell key={entry.label} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono-num text-xl font-semibold text-foreground">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">totale</span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1.5 text-sm">
        {dataWithTotal.map((entry, i) => (
          <li key={entry.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              {entry.label}
            </span>
            <span className="font-mono-num font-medium text-foreground">
              {entry.value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({((entry.value / total) * 100).toFixed(0)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
