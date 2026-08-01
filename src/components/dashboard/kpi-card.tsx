import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}

export function KpiCard({ label, value, icon: Icon, hint, tone = "default" }: KpiCardProps) {
  return (
    // h-full: le card in una riga della grid si stretchano già alla stessa
    // altezza; flex-col + value in fondo (mt-auto) fa sì che un'etichetta su
    // due righe non disallinei il valore rispetto alle card con etichetta
    // su una riga sola.
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 transition-transform duration-300 group-hover:scale-125"
        aria-hidden
      />
      {/* Etichetta e badge sono fianco a fianco in un flex row: l'etichetta
          può andare su due righe senza mai finire sotto l'icona, che resta
          shrink-0 nella sua colonna. */}
      <div className="relative flex items-start gap-3">
        <p className="min-w-0 flex-1 text-xs leading-snug font-semibold uppercase tracking-[0.02em] text-muted-foreground">
          {label}
        </p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </div>
      <p
        className={cn(
          "relative mt-auto pt-3 font-mono-num text-2xl font-semibold tracking-normal sm:text-[1.7rem]",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          tone === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="relative mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
