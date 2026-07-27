import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Topbar } from "@/components/dashboard/topbar";

// TODO(auth): questo layout è attualmente completamente anonimo (dati mock, nessuna sessione).
// Prima di collegare dati live Supabase, aggiungere qui un gate server-side:
//
//   import { createClient } from "@/lib/supabase/server";
//   import { redirect } from "next/navigation";
//
//   export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
//     const supabase = await createClient();
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();
//     if (!user) redirect("/login");
//     ...
//   }
//
// Nota: questo check è solo UX (evita di mostrare la UI a chi non è loggato). Il vero confine
// di sicurezza sui dati restano le Row Level Security policies su Supabase — vanno comunque
// configurate lato DB indipendentemente da questo redirect.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
