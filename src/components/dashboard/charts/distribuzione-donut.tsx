"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DistribuzioneVoce } from "@/types";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function DistribuzioneDonut({ data }: { data: DistribuzioneVoce[] }) {
  // Niente <Tooltip>: Recharts ancora il tooltip al punto medio (metà raggio,
  // metà angolo) della fetta puntata, che per un donut così stretto (168px,
  // innerRadius 52/outerRadius 78) cade vicino al centro. Il clamp di default
  // (allowEscapeViewBox false) impedisce solo di sforare il bordo vicino al
  // cursore, non quello opposto: se il riquadro del tooltip è più largo dello
  // spazio residuo — inevitabile in un contenitore così piccolo — sfora
  // comunque fuori dalla card e si sovrappone al totale al centro. Il centro
  // diventa quindi il display della fetta puntata: stesso dato del tooltip,
  // nessuna sovrapposizione, e resta disponibile senza mouse perché la
  // legenda a fianco lo riporta già.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  const dataWithTotal = data.map((d) => ({ ...d, total }));

  if (total === 0) {
    return (
      <div className="flex h-[168px] w-full items-center justify-center text-sm text-muted-foreground">
        Nessun dato
      </div>
    );
  }

  const active = activeIndex !== null ? dataWithTotal[activeIndex] : null;
  const activePct = active ? ((active.value / total) * 100).toFixed(0) : null;

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
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {dataWithTotal.map((entry, i) => (
                <Cell
                  key={entry.label}
                  fill={PALETTE[i % PALETTE.length]}
                  opacity={active === null || i === activeIndex ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {active ? (
            <>
              <span className="font-mono-num text-xl font-semibold text-foreground">{active.value}</span>
              <span className="w-full truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {active.label} · {activePct}%
              </span>
            </>
          ) : (
            <>
              <span className="font-mono-num text-xl font-semibold text-foreground">{total}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">totale</span>
            </>
          )}
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-1.5 text-sm">
        {dataWithTotal.map((entry, i) => (
          <li key={entry.label} className="flex items-center justify-between gap-3">
            {/* L'etichetta può troncare con ellissi (min-w-0 + truncate): il
                valore numerico non deve mai restringersi, altrimenti si
                taglia a metà cifra ("393" -> "39:") invece di andare a capo. */}
            <span
              className="flex min-w-0 items-center gap-2 truncate text-muted-foreground"
              title={entry.label}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate">{entry.label}</span>
            </span>
            <span className="shrink-0 font-mono-num font-medium whitespace-nowrap text-foreground">
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
