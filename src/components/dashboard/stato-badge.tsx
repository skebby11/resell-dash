import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatoArticolo } from "@/types";

const STATO_STYLE: Record<StatoArticolo, string> = {
  acquistato: "bg-secondary text-secondary-foreground border-transparent",
  "in vendita": "bg-chart-3/15 text-[oklch(0.4_0.1_80)] border-chart-3/30",
  venduto: "bg-primary/12 text-primary border-primary/25",
  consegnato: "bg-accent text-accent-foreground border-transparent",
};

export function StatoBadge({ stato }: { stato: StatoArticolo }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", STATO_STYLE[stato])}>
      {stato}
    </Badge>
  );
}
