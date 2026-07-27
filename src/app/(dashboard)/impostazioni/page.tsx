import { CheckCircle2, CircleDashed, Database, ScanBarcode, Sparkles, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

// TODO(security): questa pagina è renderizzata lato server ma è raggiungibile da qualsiasi
// utente anonimo (nessun gate di auth ancora). Non calcolare/esporre qui lo stato di readiness
// di segreti server-only (service role key, API key varie): rivelerebbe a chiunque quali
// credenziali sono configurate. Quando si aggiunge auth admin, spostare il check di quelle
// capability dietro una route/server action protetta da sessione autenticata.

interface Capability {
  nome: string;
  descrizione: string;
  icon: typeof Database;
  // "public": readiness calcolabile lato client dalle NEXT_PUBLIC_* (già esposte nel bundle).
  // "server": dipende da segreti server-only; niente stato booleano pubblico qui.
  kind: "public" | "server";
  envVars?: string[];
}

const CAPABILITIES: Capability[] = [
  {
    nome: "Dati live",
    descrizione: "Supabase per prodotti e articoli reali (invece dei dati mock).",
    icon: Database,
    kind: "public",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    nome: "Barcode",
    descrizione: "UPCitemdb per riconoscere prodotti da codice a barre.",
    icon: ScanBarcode,
    kind: "server",
  },
  {
    nome: "Voce",
    descrizione: "Trascrizione e assistente vocale (Groq + Anthropic).",
    icon: Sparkles,
    kind: "server",
  },
  {
    nome: "IGDB",
    descrizione: "Metadati e copertine dei videogiochi (Twitch).",
    icon: Gamepad2,
    kind: "server",
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
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            // Per le capability "server" non calcoliamo/mostriamo un booleano reale: vedi TODO
            // in cima al file. Mostriamo solo un badge neutro.
            const configured = cap.kind === "public" ? isConfigured(cap.envVars ?? []) : null;
            return (
              <div key={cap.nome} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{cap.nome}</p>
                    <p className="text-xs text-muted-foreground">{cap.descrizione}</p>
                  </div>
                </div>
                {configured === null ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <CircleDashed className="size-3.5" strokeWidth={2.5} />
                    Configurazione server
                  </span>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
