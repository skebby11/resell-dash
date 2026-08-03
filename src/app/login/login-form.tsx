"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviaMagicLink, type StatoLogin } from "./actions";

function BottoneInvia() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-1 w-full" disabled={pending}>
      <Mail className="size-4" />
      {pending ? "Invio in corso…" : "Inviami il link di accesso"}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [stato, action] = useActionState<StatoLogin, FormData>(inviaMagicLink, {});

  if (stato.inviato) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-lg border border-border bg-accent/40 px-4 py-6 text-center"
        role="status"
      >
        <CheckCircle2 className="size-7 text-accent-foreground" strokeWidth={2} />
        <div>
          <p className="text-sm font-medium text-foreground">Controlla la posta</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Se l&apos;indirizzo è autorizzato, riceverai un link di accesso valido una sola volta.
            Aprilo su questo stesso browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@esempio.it"
          aria-invalid={Boolean(stato.errore)}
          aria-describedby={stato.errore ? "errore-login" : undefined}
        />
        {stato.errore && (
          <p id="errore-login" role="alert" className="text-xs text-destructive">
            {stato.errore}
          </p>
        )}
      </div>
      <BottoneInvia />
    </form>
  );
}
