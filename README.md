# Rewind

**Open-source reselling dashboard for video games & consoles** — track inventory, sales, and profit for your Vinted, eBay, and Wallapop flipping business, self-hosted.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2F%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

Rewind is a self-hosted dashboard for people who buy and resell video games, consoles, controllers,
and accessories (Vinted, eBay, Wallapop, friends & family) as a side hustle or small business. It
replaces the typical reselling spreadsheet with a proper inventory manager: KPIs, charts, and
tables for sales, profit, and capital tied up in stock.

<!-- Add a real screenshot of the dashboard at docs/screenshot-dashboard.png — see docs/README.md for instructions. -->

![Rewind dashboard](docs/screenshot-dashboard.png)

## Features

- **Analytics dashboard** — KPIs (number of sales, average sale price, total revenue, profit,
  capital tied up in stock, invested capital), a monthly sales chart, and category / platform /
  source / destination breakdowns.
- **Inventory management** — table of items (`articoli`) with status filters
  (`acquistato` / `in vendita` / `venduto` / `consegnato`) and search.
- **Product catalog** — reusable product records (`prodotti`) for models like "PS5 Slim" or
  "FIFA 24", with average purchase/sale price.
- **Manual entry form** — add a new purchase/item by hand.
- **Settings page** — overview of which integrations (env vars) are configured.

### Roadmap / Planned (not implemented yet)

- **Barcode scanning** for fast item entry: internal catalog lookup → UPCitemdb API →
  IGDB → manual fallback.
- **Voice entry**: record audio → transcription via Whisper (Groq) → parsing with Claude →
  user confirmation.
- **Live Supabase data** — the app currently runs entirely on deterministic mock data
  (`src/lib/mock-data.ts`); wiring up real Postgres queries is the next major milestone.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router, Turbopack) | 16.2.11 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | ^4 |
| Components | shadcn/ui, @base-ui/react | ^4.14.1 / ^1.6.0 |
| Charts | Recharts | ^3.10.0 |
| Backend | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | ^2.110.8 / ^0.12.3 |
| Icons | lucide-react | ^1.26.0 |
| Deployment | Vercel | — |

## Getting Started

### Prerequisites

- Node.js 20 or 22
- npm (comes with Node)
- A [Supabase](https://supabase.com/) project (optional for now — the app runs fully on mock
  data without it)

### Installation

```bash
git clone https://github.com/skebby11/resell-dash.git
cd resell-dash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your own values (see [Environment Variables](#environment-variables)
below — all of them are optional while the app runs on mock data).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard works out of the box with
mock data — no `.env.local` configuration is required to try it out.

### Available scripts

```bash
npm run dev     # start the dev server (Turbopack)
npm run build   # production build
npm run start   # run the production build
npm run lint    # run ESLint
```

## Environment Variables

All variables are defined in [`.env.example`](./.env.example). None are required to run the app
with mock data; they become necessary once you wire up Supabase and the planned AI/barcode
integrations.

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (exposed to the browser) | Optional today, required for live data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (exposed to the browser) | Optional today, required for live data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only**, never expose to the client | Optional today, required for server-side live data |
| `ANTHROPIC_API_KEY` | Claude API key, for planned AI automations (voice entry parsing) | Optional (roadmap) |
| `GROQ_API_KEY` | Groq API key, for fast/cheap LLM inference (planned Whisper transcription) | Optional (roadmap) |
| `UPCITEMDB_API_KEY` | UPCitemdb API key, for barcode-to-product lookup | Optional (roadmap) |
| `TWITCH_CLIENT_ID` | Twitch app client ID, used to authenticate against IGDB | Optional (roadmap) |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret, used to authenticate against IGDB | Optional (roadmap) |

## Database Setup

Rewind ships with a reference Postgres schema in
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql). It is **not applied
automatically** — the app currently runs on mock data (`src/lib/mock-data.ts`).

To set it up:

1. Create a free project at [supabase.com](https://supabase.com/).
2. Apply the migration, either:
   - **Supabase SQL Editor**: open the SQL Editor in your project dashboard, paste the contents
     of `supabase/migrations/0001_init.sql`, and run it; or
   - **Supabase CLI**:
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
3. Copy your project URL and anon key into `.env.local`.

### Schema overview

- **`prodotti`** — product catalog: model name, category, gaming platform, average
  purchase/sale price, barcode, photo.
- **`articoli`** — individual physical items bought (and possibly sold), linked to a
  `prodotto`. Tracks purchase date/cost/source, status (`acquistato` / `in vendita` /
  `venduto` / `consegnato`), sale date/price/platform/fees/shipping, and destination.
  The `profitto` column is a **generated/stored column**:
  `prezzo_vendita - costo_acquisto - costo_spedizione - fee`.
- **`impostazioni`** — generic key/value store for app settings.
- **`v_vendite_mensili`** (view) — monthly aggregation of sold/delivered items: count,
  average sale price, total revenue, total profit.

## Project Structure

```
src/
  app/
    (dashboard)/
      layout.tsx        # sidebar + topbar shell
      page.tsx           # analytics dashboard (KPIs, charts, monthly table)
      articoli/          # items table, with status filters + search
      catalogo/           # product catalog
      inserimento/        # new purchase entry form
      impostazioni/       # integration status (env) + account preferences
    layout.tsx           # root layout: fonts, Toaster
    globals.css          # theme (colors, fonts, radius)
  components/
    dashboard/            # sidebar, topbar, KPI card, chart card, status badge
      charts/              # Recharts components (monthly combo chart, distribution donut)
    ui/                    # shadcn/ui components
  lib/
    mock-data.ts           # mock products + items, and derived aggregations (KPIs, monthly, distributions)
    format.ts              # currency/date formatting (it-IT locale)
    supabase/
      client.ts             # Supabase browser client (stub, reads env)
      server.ts             # Supabase server + service-role client (stub)
  types/
    index.ts               # Prodotto, Articolo, VenditaMensile, etc.
supabase/
  migrations/
    0001_init.sql          # reference Postgres schema (not applied automatically)
```

## Deployment

Rewind is built to deploy on [Vercel](https://vercel.com/):

1. Push your fork/clone to GitHub.
2. Import the repository in Vercel.
3. Add the environment variables from [`.env.example`](./.env.example) in the Vercel project
   dashboard (**Settings → Environment Variables**) — at minimum the Supabase ones once you
   move off mock data.
4. Deploy. Vercel will run `npm run build` automatically.

## Contributing

Contributions are welcome. To propose a change:

1. Open an issue describing the bug or feature.
2. Fork the repo and create a branch for your change.
3. Make sure `npm run lint` passes.
4. Open a pull request describing what changed and why.

## License

Licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 Sebastiano (skebby11).

## Acknowledgements

Built with [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/),
[Recharts](https://recharts.org/), and [Supabase](https://supabase.com/).
