import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
      <Brand onDark />
      <div className="mt-8 flex-1">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/60">
          Navigazione
        </p>
        <SidebarNav />
      </div>
      {/* La sidebar è sempre scura: qui servono i token --sidebar-*, non
          --background/--foreground (pensati per il contenuto chiaro), altrimenti
          in light mode il riquadro diventa un patch chiaro poco leggibile. */}
      <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3.5">
        <p className="font-display text-sm italic text-sidebar-foreground">Prossimo obiettivo</p>
        <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/70">
          Inserimento da barcode e da voce, per registrare un acquisto in pochi secondi.
        </p>
      </div>
    </aside>
  );
}
