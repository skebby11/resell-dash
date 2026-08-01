import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/dashboard/brand";

export default async function AuthErrorePage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Brand />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto size-7 text-destructive" strokeWidth={2} />
          <h1 className="mt-3 font-display text-lg italic text-foreground">Accesso non riuscito</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Il link potrebbe essere scaduto, già utilizzato, oppure aperto in un browser diverso da
            quello da cui l&apos;hai richiesto. Richiedine uno nuovo.
          </p>
          {motivo && (
            // Il messaggio arriva da GoTrue, non dall'utente: utile in debug.
            <p className="mt-3 break-words rounded-md bg-secondary px-2.5 py-2 font-mono-num text-[11px] text-muted-foreground">
              {motivo}
            </p>
          )}
          <Button render={<Link href="/login" />} nativeButton={false} className="mt-5 w-full">
            Torna al login
          </Button>
        </div>
      </div>
    </main>
  );
}
