import type { Metadata } from "next";
import { Brand } from "@/components/dashboard/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Accedi — Rewind",
};

export default async function LoginPage({
  searchParams,
}: {
  // In Next.js 16 searchParams è asincrono.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destinazione = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Brand />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="font-display text-lg italic text-foreground">Accedi</h1>
          <p className="mt-1 mb-5 text-xs leading-relaxed text-muted-foreground">
            Accesso solo su invito: nessuna registrazione. Inserisci la tua email e ti arriva un
            link per entrare, senza password.
          </p>
          <LoginForm next={destinazione} />
        </div>
      </div>
    </main>
  );
}
