import { CheckCircle2, CircleDashed, Database, ScanBarcode, Sparkles, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Integrazione {
  nome: string;
  descrizione: string;
  icon: typeof Database;
  envVars: string[];
}

const INTEGRAZIONI: Integrazione[] = [
  {
    nome: "Supabase",
    descrizione: "Database e autenticazione (prodotti, articoli, impostazioni).",
    icon: Database,
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    nome: "Barcode lookup",
    descrizione: "UPCitemdb per riconoscere prodotti da codice a barre.",
    icon: ScanBarcode,
    envVars: ["UPCITEMDB_API_KEY"],
  },
  {
    nome: "IGDB / Twitch",
    descrizione: "Metadati e copertine dei videogiochi.",
    icon: Gamepad2,
    envVars: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
  },
  {
    nome: "AI (Anthropic / Groq)",
    descrizione: "Automazioni e suggerimenti generati via LLM.",
    icon: Sparkles,
    envVars: ["ANTHROPIC_API_KEY", "GROQ_API_KEY"],
  },
];

function isConfigured(envVars: string[]): boolean {
  return envVars.every((v) => Boolean(process.env[v]));
}

export default function ImpostazioniPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg italic text-foreground">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dashboard single-user. Le preferenze personali (valuta, lingua, timezone) arriveranno con
          l&apos;integrazione Supabase.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valuta</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">Euro (€)</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lingua</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">Italiano</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg italic text-foreground">Integrazioni</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stato delle variabili d&apos;ambiente lette da <span className="font-mono-num">.env.local</span>.
        </p>

        <div className="mt-4 flex flex-col divide-y divide-border">
          {INTEGRAZIONI.map((integ) => {
            const configured = isConfigured(integ.envVars);
            const Icon = integ.icon;
            return (
              <div key={integ.nome} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{integ.nome}</p>
                    <p className="text-xs text-muted-foreground">{integ.descrizione}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    configured
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {configured ? (
                    <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    <CircleDashed className="size-3.5" strokeWidth={2.5} />
                  )}
                  {configured ? "Configurato" : "Non configurato"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
