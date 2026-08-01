"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/login/actions";

export function UserMenu({ email }: { email: string }) {
  const iniziale = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Account: ${email}`}
      >
        <Avatar className="size-9 border border-border">
          <AvatarFallback className="bg-accent font-display italic text-accent-foreground">
            {iniziale}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 min-w-56">
        <div className="px-1.5 py-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Connesso come</p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={email}>
            {email}
          </p>
        </div>
        <DropdownMenuSeparator />
        {/* Il logout è una server action: invalida la sessione su Supabase e
            cancella i cookie, non basta svuotare lo stato lato client.
            `closeOnClick={false}`: chiudere il menu smonterebbe il form nello
            stesso tick del submit. Il redirect della action chiude comunque. */}
        <form action={logout}>
          <DropdownMenuItem
            variant="destructive"
            closeOnClick={false}
            render={<button type="submit" className="w-full" />}
            nativeButton
          >
            <LogOut />
            Esci
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
