import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { getUtenteCorrente } from "@/lib/data/queries";

// Il proxy (`src/proxy.ts`) già respinge le richieste senza sessione, ma quel
// controllo è ottimistico: gira su ogni route, anche prefetch, e per restare
// veloce non può fare altro. Questo gate ripete la verifica vicino ai dati.
//
// Nessuno dei due è il vero confine di sicurezza: quello sono le RLS su
// Postgres, che filtrano per claim `email` contro `utenti_autorizzati`.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const utente = await getUtenteCorrente();
  if (!utente) redirect("/login");

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={utente.email} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
