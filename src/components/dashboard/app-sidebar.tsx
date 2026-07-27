import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
      <Brand />
      <div className="mt-8 flex-1">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Navigazione
        </p>
        <SidebarNav />
      </div>
      <div className="rounded-lg border border-sidebar-border bg-background/60 p-3.5">
        <p className="font-display text-sm italic text-foreground">Prossimo obiettivo</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Collega Supabase da <span className="font-mono-num">.env.local</span> per passare ai dati reali.
        </p>
      </div>
    </aside>
  );
}
