"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
        <Menu className="size-5" />
        <span className="sr-only">Apri menu</span>
      </SheetTrigger>
      {/* text-sidebar-foreground: il pannello forza bg-sidebar (sempre blu
          notte), ma il colore ambiente di SheetContent è pensato per il
          popover chiaro. Senza l'override il pulsante di chiusura (che eredita
          il colore, non lo imposta) risulterebbe scuro su scuro. */}
      <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground p-4">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle className="sr-only">Menu di navigazione</SheetTitle>
          <Brand onDark />
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
