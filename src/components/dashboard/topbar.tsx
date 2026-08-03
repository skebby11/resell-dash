"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";

export function Topbar({ email }: { email: string }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => item.href === pathname) ?? NAV_ITEMS[0];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/85 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <h1 className="font-display text-xl font-bold italic tracking-tight text-foreground sm:text-2xl">
            {current.label}
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block">{current.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        <Button
          render={<Link href="/inserimento" />}
          nativeButton={false}
          size="sm"
          className="hidden sm:inline-flex"
        >
          <PlusCircle className="size-4" />
          Nuovo acquisto
        </Button>
        <Button
          render={<Link href="/inserimento" />}
          nativeButton={false}
          size="icon"
          className="sm:hidden"
          aria-label="Aggiungi nuovo articolo"
        >
          <PlusCircle className="size-4" />
        </Button>
        <UserMenu email={email} />
      </div>
    </header>
  );
}
