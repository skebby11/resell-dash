import type { LucideIcon } from "lucide-react";
import { Gauge, Globe2, ListTree, PackagePlus, Settings2, SquareLibrary } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: Gauge,
    description: "Analytics e andamento vendite",
  },
  {
    href: "/articoli",
    label: "Articoli",
    icon: ListTree,
    description: "Ogni esemplare acquistato o venduto",
  },
  {
    href: "/catalogo",
    label: "Catalogo prodotti",
    icon: SquareLibrary,
    description: "Anagrafica modelli e prezzi medi",
  },
  {
    href: "/inserimento",
    label: "Inserimento",
    icon: PackagePlus,
    description: "Registra un nuovo acquisto",
  },
  {
    href: "/vendite-ue",
    label: "Vendite UE",
    icon: Globe2,
    description: "Totali per paese e anno solare",
  },
  {
    href: "/impostazioni",
    label: "Impostazioni",
    icon: Settings2,
    description: "Preferenze e integrazioni",
  },
];
