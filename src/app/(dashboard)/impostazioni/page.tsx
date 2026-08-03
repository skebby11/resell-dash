import { CheckCircle2, CircleDashed, Database, ScanBarcode, Sparkles, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCanaliConConteggio, getUtenteCorrente } from "@/lib/data/queries";
import { CanaliManager } from "@/components/dashboard/canali-manager";
import { ETICHETTA_TIPO_CANALE, TIPI_CANALE } from "@/types";

// La pagina è ora dietro il gate del layout: solo utenti in `utenti_autorizzati`
// la raggiungono. Restiamo comunque prudenti sui segreti server-only: mostrare
// "configurato / non configurato" per le API key non aggiunge nulla di utile e
// costruisce una mappa delle credenziali. Da rivedere solo se servirà davvero.

interface Capability {
  nome: string;
  descrizione: string;
  icon: typeof Database;
  // "public": readiness calcolabile lato client dalle NEXT_PUBLIC_* (già esposte nel bundle).
  // "server": dipende da segreti server-only; niente stato booleano pubblico qui.
  // "planned": funzionalità in roadmap, non ancora implementata nel codice (vedi README).
  kind: "public" | "server" | "planned";
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
    // Nessun servizio esterno: il riconoscimento passa dal catalogo interno
    // (prodotti.barcode); solo se il codice non è ancora noto si passa a IGDB (voce sotto).
    descrizione: "Riconoscimento da codice a barre tramite il catalogo interno, senza servizi esterni.",
    icon: ScanBarcode,
    kind: "public",
    envVars: [],
  },
  {
    nome: "Voce",
    // Roadmap: nessuna route/codice di trascrizione esiste ancora (vedi README, sezione Roadmap).
    // Non va mostrata come le altre integrazioni server-only, altrimenti sembra già attiva.
    descrizione: "Trascrizione e assistente vocale (Groq + Anthropic) — non ancora implementata.",
    icon: Sparkles,
    kind: "planned",
  },
  {
    nome: "IGDB",
    descrizione: "Metadati e copertine dei videogiochi da barcode non ancora noto (credenziali Twitch).",
    icon: Gamepad2,
    kind: "server",
  },
];

function isConfigured(envVars: string[]): boolean {
  return envVars.every((v) => Boolean(process.env[v]));
}

export default async function ImpostazioniPage() {
  const [utente, { canali, orfani }] = await Promise.all([getUtenteCorrente(), getCanaliConConteggio()]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg italic text-foreground">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dashboard single-user, accesso su invito. Le email autorizzate si gestiscono nella tabella
          <span className="font-mono-num"> utenti_autorizzati</span> su Supabase.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={utente?.email}>
              {utente?.email ?? "—"}
            </p>
          </div>
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
                {cap.kind === "planned" ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <CircleDashed className="size-3.5" strokeWidth={2.5} />
                    Pianificata
                  </span>
                ) : configured === null ? (
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

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg italic text-foreground">Canali</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Piattaforme di vendita, fonti di acquisto e spedizionieri suggeriti nei form. Restano campi
          di testo libero: un valore non elencato qui resta comunque accettabile, e disattivare un
          canale non tocca gli articoli che lo usano già.
        </p>

        <div className="mt-5 flex flex-col gap-6">
          {TIPI_CANALE.map((tipo) => (
            <CanaliManager
              key={tipo}
              tipo={tipo}
              etichetta={ETICHETTA_TIPO_CANALE[tipo]}
              canali={canali.filter((c) => c.tipo === tipo)}
              orfani={orfani.filter((o) => o.tipo === tipo)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
