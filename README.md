# Rewind — Dashboard Reselling

Dashboard per la gestione di acquisti e rivendite di videogiochi, console, controller e
accessori (Vinted, eBay, Wallapop, amici/parenti). Sostituisce il Google Sheet usato in
precedenza: KPI, grafici e tabelle su vendite, profitti e capitale immobilizzato.

Stato attuale: UI completa con **dati mock**, pronta per essere collegata a Supabase.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Recharts per i grafici
- Supabase (client browser + server già predisposti, da collegare)
- lucide-react per le icone

## Avvio

```bash
npm install
cp .env.example .env.local   # valorizzare le variabili quando si collega Supabase / le API esterne
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Con i soli dati mock il progetto gira
senza bisogno di configurare `.env.local`.

## Script utili

```bash
npm run dev     # sviluppo
npm run build   # build di produzione
npm run start   # avvio build di produzione
npm run lint    # eslint
npx tsc --noEmit  # controllo tipi
```

## Struttura cartelle

```
src/
  app/
    (dashboard)/
      layout.tsx        # sidebar + topbar
      page.tsx           # Dashboard analytics (KPI, grafici, tabella mensile)
      articoli/          # Tabella articoli con filtri per stato + ricerca
      catalogo/           # Catalogo prodotti (anagrafica modelli)
      inserimento/        # Form di inserimento nuovo acquisto
      impostazioni/       # Stato integrazioni (env) e preferenze account
    layout.tsx           # Root layout: font, Toaster
    globals.css          # Tema (colori, font, radius)
  components/
    dashboard/            # Sidebar, topbar, KPI card, chart card, badge stato
      charts/              # Grafici Recharts (combo mensile, donut distribuzione)
    ui/                    # Componenti shadcn/ui
  lib/
    mock-data.ts           # Prodotti + articoli mock e aggregazioni derivate (KPI, mensili, distribuzioni)
    format.ts              # Formattazione valuta/date (it-IT)
    supabase/
      client.ts             # Client Supabase browser (stub, legge le env)
      server.ts             # Client Supabase server + service role (stub)
  types/
    index.ts               # Tipi Prodotto, Articolo, VenditaMensile, ecc.
supabase/
  migrations/
    0001_init.sql          # Schema Postgres di riferimento (non applicato)
```

## Dati mock

`src/lib/mock-data.ts` genera ~37 articoli (con PRNG a seed fisso, deterministico tra
server e client) distribuiti su 6 mesi, con categorie, piattaforme di vendita, fonti
d'acquisto e destinazioni realistiche. Tutti i KPI e i grafici della dashboard derivano
da questi dati: sostituendo le funzioni in questo file con query Supabase, il resto della
UI non cambia.

## Prossimi passi

1. Creare un progetto Supabase e applicare `supabase/migrations/0001_init.sql`.
2. Valorizzare `.env.local` (vedi `.env.example`).
3. Sostituire le funzioni di `src/lib/mock-data.ts` con chiamate reali tramite
   `src/lib/supabase/client.ts` / `server.ts`.
