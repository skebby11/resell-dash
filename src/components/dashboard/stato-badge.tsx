import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatoArticolo } from "@/types";

const STATO_STYLE: Record<StatoArticolo, string> = {
  acquistato: "bg-secondary text-secondary-foreground border-transparent",
  "in vendita": "bg-chart-3/15 text-accent-foreground border-chart-3/30",
  // Il giallo del brand non è leggibile come testo: qui resta solo la
  // superficie (wash), il testo è blu notte (--foreground).
  venduto: "bg-primary/15 text-foreground border-primary/30",
  consegnato: "bg-accent text-accent-foreground border-transparent",
};

export function StatoBadge({ stato }: { stato: StatoArticolo }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", STATO_STYLE[stato])}>
      {stato}
    </Badge>
  );
}
