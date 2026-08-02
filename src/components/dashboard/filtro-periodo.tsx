import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { presetAttivo, presetPeriodo, type Periodo, type PresetPeriodo } from "@/lib/data/periodo";

const ETICHETTE: Record<"tutto" | PresetPeriodo, string> = {
  tutto: "Tutto",
  "anno-corrente": "Quest'anno",
  "anno-precedente": "Anno scorso",
  "ultimi-12-mesi": "Ultimi 12 mesi",
};

/**
 * Filtro periodo della dashboard: preset rapidi più intervallo personalizzato,
 * stato nell'URL (`?da=&a=`) come già fanno `/articoli` e `/catalogo`. Nessun
 * JavaScript: link e un form GET nativo, la data "oggi" è calcolata lato
 * server al momento della richiesta.
 */
export function FiltroPeriodo({ periodo }: { periodo: Periodo }) {
  const oggi = new Date();
  const preset = presetPeriodo(oggi);
  const attivo = presetAttivo(periodo, oggi);

  function href(p?: Periodo) {
    const params = new URLSearchParams();
    if (p?.da) params.set("da", p.da);
    if (p?.a) params.set("a", p.a);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  const voci: { chiave: "tutto" | PresetPeriodo; url: string }[] = [
    { chiave: "tutto", url: href() },
    { chiave: "anno-corrente", url: href(preset["anno-corrente"]) },
    { chiave: "anno-precedente", url: href(preset["anno-precedente"]) },
    { chiave: "ultimi-12-mesi", url: href(preset["ultimi-12-mesi"]) },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-secondary p-1">
        {voci.map((v) => (
          <Link
            key={v.chiave}
            href={v.url}
            aria-current={attivo === v.chiave ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              attivo === v.chiave
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {ETICHETTE[v.chiave]}
          </Link>
        ))}
      </div>

      {/* Form GET nativo: nessun JavaScript, il periodo personalizzato resta
          nell'URL come i preset. Le date invalide non fanno fallire la
          pagina: risolviPeriodo lato server le tratta come "nessun limite". */}
      <form action="/" className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="periodo-da" className="text-xs text-muted-foreground">
            Da
          </Label>
          <Input
            id="periodo-da"
            type="date"
            name="da"
            defaultValue={periodo.da ?? ""}
            className="h-8 w-[9.5rem]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="periodo-a" className="text-xs text-muted-foreground">
            A
          </Label>
          <Input
            id="periodo-a"
            type="date"
            name="a"
            defaultValue={periodo.a ?? ""}
            className="h-8 w-[9.5rem]"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Applica
        </Button>
      </form>
    </div>
  );
}
