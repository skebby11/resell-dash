import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Il logo compare su due sfondi diversi: dentro alla chrome di navigazione
 * (sempre blu notte, in light e dark mode) e da solo su /login e
 * /auth/errore (dove segue il tema normale). `onDark` sceglie i token del
 * sidebar invece di quelli del contenuto, per restare leggibile in entrambi.
 */
export function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Disc3 className="size-5" strokeWidth={2.25} />
      </span>
      <div className="flex flex-col leading-none">
        {/* Wordmark in maiuscolo, condensato, corsivo, peso alto: stessa
            ricetta tipografica del logo "DIECI MENO" del cliente. */}
        <span
          className={cn(
            "font-display text-xl font-extrabold uppercase italic leading-none tracking-tight",
            onDark ? "text-sidebar-foreground" : "text-foreground"
          )}
        >
          Rewind
        </span>
        <span
          className={cn(
            "mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
            onDark ? "text-sidebar-foreground/70" : "text-muted-foreground"
          )}
        >
          Reselling Studio
        </span>
      </div>
    </div>
  );
}
