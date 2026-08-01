import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Stato vuoto: mostrato quando il database non ha ancora dati. È il caso normale
 * al primo avvio, non un errore, quindi propone l'azione successiva invece di
 * lasciare la pagina con una griglia di zeri.
 */
export function StatoVuoto({
  titolo,
  descrizione,
  azione,
}: {
  titolo: string;
  descrizione: string;
  azione?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <PackageOpen className="size-5" strokeWidth={2} />
      </span>
      <div className="max-w-md">
        <h2 className="font-display text-base italic text-foreground">{titolo}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{descrizione}</p>
      </div>
      {azione && (
        <Button
          render={<Link href={azione.href} />}
          nativeButton={false}
          size="sm"
          className="mt-2"
        >
          {azione.label}
        </Button>
      )}
    </div>
  );
}
