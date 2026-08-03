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
- **Inventory management** — paginated table of items (`articoli`) with status filters
  (`acquistato` / `in vendita` / `venduto` / `consegnato`) and search. Filtering, search and
  pagination run in Postgres, not in the browser.
- **Sale recording** — mark an item as sold from the items table: date, price, fee, shipping,
  platform, courier, destination. Profit is computed by the database, never by the app. Quick
  state transitions (list for sale, mark delivered) and an undo that clears the sale data.
- **Product catalog** — reusable product records (`prodotti`) for models like "PS5 Slim" or
  "FIFA 24", with average purchase/sale price recomputed from actual history.
- **Manual entry form** — add a new purchase by hand. The product is given by name with
  autocomplete over the catalog; an unknown name creates the product on save.
- **Barcode lookup** — scan or type a barcode to recognize an item you've already handled before:
  internal catalog first (zero external calls), and for a barcode the catalog doesn't know yet,
  search the title on [IGDB](#barcode-lookup) and pick from the results to link it. See
  [Barcode lookup](#barcode-lookup) below for how it works and how to get API keys.
- **Spreadsheet import** — bulk import from a Google Sheets CSV export, with a dry-run mode.
- **Invite-only auth** — passwordless email magic link. There is no sign-up flow: access is
  restricted to an allowlist of email addresses, enforced in Row Level Security policies.
- **Settings page** — current account and integration status.

### Roadmap / Planned (not implemented yet)

- **Voice entry**: record audio → transcription via Whisper (Groq) → parsing with Claude →
  user confirmation.
- **Editing purchase data** — purchase date, cost and source can only be set at creation; there
  is no edit form for them yet (the sale side is fully editable).
- **Paid barcode source (optional)** — [PriceCharting's API](#is-there-a-free-barcode--video-game-source-research-notes)
  genuinely supports UPC lookup for video games, but requires its $49/month Legendary tier. Not
  integrated; would slot in as an optional step gated behind its own environment variable if the
  owner decides the cost is worth it.

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

- Node.js 20 or later
- npm (comes with Node)
- A [Supabase](https://supabase.com/) project — **required**. Every page reads from Postgres
  and is behind authentication; there is no offline/demo mode.

### Installation

```bash
git clone https://github.com/skebby11/resell-dash.git
cd resell-dash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your Supabase URL and publishable key (see
[Environment Variables](#environment-variables)), then apply the schema and create your user —
see [Database Setup](#database-setup) and [Authentication](#authentication).

```bash
npm run seed    # populate the product catalog (add -- --demo for sample items too)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`: enter
an allowlisted email address and follow the magic link.

### Available scripts

```bash
npm run dev        # start the dev server (Turbopack)
npm run build      # production build
npm run start      # run the production build
npm run lint       # run ESLint
npm run typecheck  # run tsc --noEmit
npm test           # run the unit tests (Vitest)
npm run seed       # seed the product catalog from src/lib/mock-data.ts
npm run import     # bulk import from a spreadsheet CSV (see below)
```

## Importing from a spreadsheet

If you are coming from a reselling spreadsheet, export the inventory sheet as CSV and import it.
Always dry-run first — it prints the row counts, the resulting state distribution and every
anomaly found, and writes nothing:

```bash
npm run import -- --file "/path/to/Inventario.csv" --dry-run
npm run import -- --file "/path/to/Inventario.csv"
```

The importer refuses to run when `articoli` is non-empty (pass `--append` to override), because
items have no natural key and a second run would create indistinguishable duplicates.

It expects the column layout of the "FLIP DASHBOARD - Inventario" sheet. The non-obvious
transformations are documented at the top of
[`scripts/import-csv.ts`](./scripts/import-csv.ts); the ones worth knowing about:

- **Rows with no item name are dropped** — they are spreadsheet padding, not items.
- **The sheet's `Fee` is a percentage**, while `articoli.fee` is an amount: it is converted with
  `price × pct / 100` and stored unrounded, so totals stay reconcilable with the source.
- **The sheet's states are coarser** than the schema's four: `Venduto - Consegnato` → `consegnato`,
  `Venduto - Spedito` → `venduto`, `Acquistato - *` and blank → `acquistato`. The sheet has no
  "listed for sale" concept, so none is invented.
- **Rows marked sold but missing a sale date or price** would violate the database CHECK
  constraint. They are imported as `acquistato` with a note explaining the discrepancy, and
  listed as anomalies in the output — the item is real, its recorded state is not trustworthy.
- The product catalog is built by deduplicating item names, then `prezzo_medio_acquisto` and
  `prezzo_medio_vendita` are recomputed from the imported history.

## Barcode lookup

The value a barcode gives this app isn't "resolve an unknown code via a third-party service" — a
resale business handles the same models over and over (1119 items across 850 distinct products in
the real dataset behind this app). The value is recognizing an item you've already handled, in an
instant. So the catalog itself becomes the barcode database, and it grows richer the more you use
the app:

1. **Internal catalog first** (`prodotti.barcode`, unique) — `GET /api/barcode?barcode=…` checks
   this and only this. If the exact barcode was already saved on a product, that product resolves
   immediately: name, category, platform, cover, historical average purchase/sale price. Zero
   external calls, zero cost, works even with no third-party credentials configured at all.
2. **Unknown barcode → search by title on [IGDB](https://www.igdb.com/api)** — if the catalog
   doesn't know the code yet, the form offers a title search (`GET /api/igdb?q=…`). The user types
   the title and picks from a list of candidates, each shown with platform(s), release year and
   cover so games with multiple editions/ports/remasters are easy to tell apart (see
   [Search relevance](#search-relevance) below). Picking one fills name, category ("Videogiochi",
   implied by an IGDB match), platform and cover — all marked "to confirm" until reviewed, since a
   wrong pre-filled field is worse than an empty one.
3. **Linking on save** — when the purchase is saved, the barcode is linked to the product that was
   picked or created. From the next scan onward, that barcode resolves at step 1, with no IGDB call
   at all.
4. **Manual fallback** — if nothing is picked, fields stay empty for manual entry. This is never an
   error state.

Barcodes are validated and normalized server-side (digits only, EAN-8/UPC-A/EAN-13 lengths) before
any external call is made, and third-party API keys are read only in server code (route
handlers/server actions) — they never reach the browser. When IGDB credentials are absent, step 2
is simply unavailable (no error, no 500): the catalog-first step still works, and manual entry is
always there.

If your device runs Chrome or Safari with the [`BarcodeDetector`
API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector), a "Scansiona" (Scan)
button opens the camera and reads the barcode live; it is feature-detected (not user-agent
sniffed) and simply doesn't appear where the API isn't available — typing the code by hand always
works.

### Why UPCitemdb was removed

An earlier version of this lookup cascaded through [UPCitemdb](https://www.upcitemdb.com/) between
the catalog and IGDB. It was dropped: **UPCitemdb's free tier cannot actually be registered for —
the ~100 free requests/day only work from their own API explorer page, not from a real
application.** The `prod/trial/lookup` endpoint does respond to plain server-side requests (we
verified this), but it's explicitly a trial/explorer endpoint, not a documented public API tier;
building a feature on it would be fragile and outside their terms of use. No replacement barcode
service was substituted in its place — see the next section for what was actually evaluated and
why nothing qualified.

### Is there a free barcode → video game source? (research notes)

We looked for a source usable server-side, for free or at negligible cost, within its terms of
use, to resolve a retail EAN/UPC straight to a game title — as an optional step between catalog and
IGDB search. None qualified, so none was integrated:

- **IGDB `external_games`** — confirmed against the live API and the field docs: its `category`
  enum is exclusively digital storefronts (Steam, GOG, Microsoft Store, PlayStation Store, Xbox
  Marketplace, Epic Games Store, etc.) and a `media` field that's just digital-vs-physical, not an
  identifier. No barcode/EAN/UPC field exists on this endpoint at all.
- **Wikidata SPARQL** (public, free, no key) — has a GTIN property (`P3962`). Queried live: **only
  59 GTIN statements exist across every item classified as "video game" on all of Wikidata.**
  Nowhere near usable coverage for a real catalog.
- **TheGamesDB** — fetched its actual OpenAPI spec. Its only endpoints are `ByGameID`,
  `ByGameName`, `ByPlatformID`, `Images`, `Updates`, `Platforms`, `Genres`, `Developers`,
  `Publishers`. There is no barcode/UPC/EAN parameter or field anywhere in the API — not a coverage
  gap, the capability plain doesn't exist.
- **MobyGames** — does have a community-curated "product codes" field on some releases (including
  UPC/EAN), but its API moved to a paid **MobyPro** subscription; free non-commercial keys now
  require an application/approval process rather than self-serve signup, so it isn't reliably
  "usable from a server app" the way the task requires.
- **PriceCharting** — the strongest real candidate found. Its documented API genuinely supports
  `GET /api/product?upc=045496830434` (verified live: a UPC parameter that resolves a real product
  by barcode, video-game-focused, ToS-compliant). However, an API token requires the **Legendary**
  subscription tier at **$49/month** — not free or negligible. Reported here for the owner to
  decide; not integrated, since integrating a paid dependency isn't a call this task should make
  unilaterally.
- **EAN-Search.org** — general-purpose barcode database (claims 1.2 billion barcodes), no free
  tier: trial is €1 for the first month then €9/month for 100 queries, with no confirmed
  video-game-specific coverage. Reported, not integrated.
- **Open GTIN Database (opengtindb.org)** — free API in principle, but the shared public test
  `queryid` was already rate-limited on the very first live request we made (`error=5`); a real
  key needs manual signup with an unclear approval process, and it's a small volunteer-run project
  with general retail (not gaming) focus. Same structural problem as UPCitemdb's trial endpoint —
  ruled out for the same reason.

If a real free/negligible-cost option shows up later, it belongs as an optional step gated behind
its own environment variable, degrading cleanly when unset — exactly like IGDB does today. A
documented "no good free option exists" is worth more than building on a fragile trial quota.

### Search relevance

`search "zelda breath of the wild"` on `/v4/games` with no filter returns, in this order, a bundle
("...Expansion Pass Bundle") and a Wii U multiplayer mod — not the actual game. Fixed with two
findings verified against the live API:

- IGDB's `category` field on `/games` is mid-migration to `game_type` (same enum values, new
  field name — see IGDB's "Enums to Tables" changelog). Combining the **old** `category` field with
  `search` in a `where` clause silently returns zero results; `game_type` works correctly. The
  lookup uses `game_type`.
- `where game_type = (0,4,8,9,10,11)` (main_game, standalone_expansion, remake, remaster,
  expanded_game, port) excludes bundle(3), mod(5), dlc_addon(1), expansion(2), episode(6),
  season(7), pack(13), update(14) — precisely the noise above — while still keeping real physical
  editions (Collector's/Limited Edition, which often have their own barcode) in the results.
- IGDB rejects combining `sort` with `search` (HTTP 406: "Search is sorting on relevancy"), so a
  category filter alone isn't enough against a very generic query: an unrated PC fan-mod can still
  outrank the real game on text similarity alone (seen live on "super mario odyssey"). The lookup
  re-ranks client-side, promoting results with a real popularity signal
  (`total_rating_count`/`follows` > 0) ahead of ones with none, keeping IGDB's own relevance order
  otherwise.

Since the user always picks from a shown list (never an auto-applied single guess), each candidate
displays platform(s), release year and cover — enough to tell "Resident Evil 4" (2005 original),
"Resident Evil 4" (2023 remake) and "Resident Evil 4 VR" apart at a glance.

### Getting API keys

**IGDB** requires a Twitch application, there is no keyless tier:

1. Log into [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) with any Twitch
   account and click **Register Your Application**.
2. Name it anything, set an OAuth Redirect URL (e.g. `https://localhost`, unused for this flow),
   category "Application Integration".
3. Copy the **Client ID**, then generate and copy a **Client Secret**.
4. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in `.env.local`.

Without these two, step 2 of the lookup (searching IGDB for an unknown barcode) is simply
unavailable — never an error. Step 1 (catalog-first resolution) needs no credentials at all and
always works. The OAuth token IGDB needs is cached in memory for its multi-week lifetime, not
requested on every search.

## Environment Variables

All variables are defined in [`.env.example`](./.env.example).

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (exposed to the browser) | **Yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (`sb_publishable_…`) or legacy anon key. Exposed to the browser. | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret/service role key — bypasses RLS, so **server-side only**, never in a `NEXT_PUBLIC_` variable. Needed by `npm run seed`. | For seeding |
| `NEXT_PUBLIC_SITE_URL` | Public origin used to build the magic-link return URL. Derived from request headers if unset. | In production |
| `ANTHROPIC_API_KEY` | Claude API key, for planned AI automations (voice entry parsing) | Optional (roadmap) |
| `GROQ_API_KEY` | Groq API key, for fast/cheap LLM inference (planned Whisper transcription) | Optional (roadmap) |
| `TWITCH_CLIENT_ID` | Twitch app client ID, used to authenticate against IGDB for step 2 of the barcode lookup — see [Barcode lookup](#barcode-lookup). | Optional |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret, used to authenticate against IGDB | Optional |

## Database Setup

1. Create a free project at [supabase.com](https://supabase.com/).
2. Apply the migrations in [`supabase/migrations/`](./supabase/migrations/) **in order**, either:
   - **Supabase SQL Editor**: paste each file's contents and run it; or
   - **Supabase CLI**:
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
3. Copy your project URL and publishable key into `.env.local`.
4. `npm run seed` to populate the product catalog with 18 common models.

### Schema overview

- **`prodotti`** — product catalog: model name, category, gaming platform, average
  purchase/sale price, barcode, photo.
- **`articoli`** — individual physical items bought (and possibly sold), linked to a
  `prodotto`. Tracks purchase date/cost/source, status (`acquistato` / `in vendita` /
  `venduto` / `consegnato`), sale date/price/platform/fees/shipping, destination and free-form
  notes. The `profitto` column is a **generated/stored column**:
  `prezzo_vendita - costo_acquisto - costo_spedizione - fee`, and stays `NULL` until the item is
  actually sold — an unsold item must not read as being at a loss.
- **`impostazioni`** — generic key/value store for app settings.
- **`utenti_autorizzati`** — the access allowlist: one row per authorized email address.
- **`v_kpi`, `v_vendite_mensili`, `v_distribuzione_*`** (views) — everything the dashboard shows,
  aggregated in SQL. Not an optimisation detail: PostgREST caps a range-less select at 1000 rows
  **silently**, so summing rows in the application under-reported every KPI once the inventory
  passed a thousand items. Aggregating in the database removes that failure mode and keeps the
  dashboard's cost independent of inventory size. All views use `security_invoker = true`, so they
  apply the caller's RLS rather than the owner's.

## Authentication

Rewind is single-user and **invite-only**: there is no sign-up. Access is passwordless via email
magic link, and it is gated at three independent levels:

1. **App** — the login server action calls `signInWithOtp` with `shouldCreateUser: false`, so it
   can never create an account. The form gives the same answer for authorized and unauthorized
   addresses, to avoid turning it into an account-enumeration oracle.
2. **Project** — turn off *Allow new users to sign up* in the Supabase dashboard
   (**Authentication → Sign In / Providers → Email**).
3. **Database** — every RLS policy checks the JWT `email` claim against `utenti_autorizzati`.
   Even a user created directly from the dashboard reads and writes nothing without a row there.
   The `anon` role has no privileges on any table.

### Authorizing a user

```sql
-- 1. add the address to the allowlist
insert into utenti_autorizzati (email, note) values ('you@example.com', 'owner');
```

```bash
# 2. create the account (no password: magic link only)
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","email_confirm":true}'
```

Also add `<your-origin>/auth/confirm` to the allowed **Redirect URLs** in
**Authentication → URL Configuration**.

Magic links open in the same browser that requested them, because the PKCE code verifier lives in
a cookie. To make links work from any browser, edit the **Magic Link** email template to use
`{{ .TokenHash }}`:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

`/auth/confirm` accepts both forms, so either template works without code changes.

## Project Structure

```
src/
  proxy.ts                 # Next 16 proxy (ex-middleware): session refresh + route gate
  app/
    (dashboard)/
      layout.tsx           # auth gate + sidebar/topbar shell
      page.tsx             # analytics dashboard (KPIs, charts, monthly table)
      articoli/            # items table + filters, sale dialog, state actions
      catalogo/            # product catalog, searchable and paginated
      inserimento/         # new purchase entry form + server action
      impostazioni/        # account + integration status
    login/                 # magic-link login page, form and server actions
    auth/
      confirm/route.ts     # magic-link landing: token_hash or PKCE code → session
      errore/              # expired / already-used / wrong-browser link
    layout.tsx             # root layout: fonts, Toaster
    globals.css            # theme (colors, fonts, radius)
  components/
    dashboard/             # sidebar, topbar, user menu, KPI card, chart card, empty state
      charts/              # Recharts components (monthly combo chart, distribution donut)
    ui/                    # shadcn/ui components
  lib/
    validazione.ts         # pure FormData parsing/validation, shared by the server actions
    mock-data.ts           # deterministic fixtures, used by tests and by the seed script
    format.ts              # currency/date formatting (it-IT locale)
    data/
      queries.ts           # data access layer: all reads, under RLS
      mappers.ts           # Postgres rows → domain types
    supabase/
      client.ts            # browser client
      server.ts            # server client + service-role client
      proxy.ts             # session refresh logic used by src/proxy.ts
  types/
    index.ts               # Prodotto, Articolo, VenditaMensile, etc.
    database.ts            # generated Postgres types
scripts/
  seed.ts                  # catalog seeding (service role, local use only)
  import-csv.ts            # spreadsheet import (service role, local use only)
supabase/
  migrations/              # apply in order
    0001_init.sql          # tables, indexes, RLS, monthly view
    0002_auth_allowlist.sql# utenti_autorizzati + email-based RLS policies
    0003_articoli_note.sql # per-item notes column
    0004_ricalcola_prezzi_medi.sql # admin function to refresh catalog averages
    0005_viste_dashboard.sql       # KPI + distribution views, list index
    0006_rls_initplan.sql          # per-row re-evaluation fix in the allowlist policy
```

## Deployment

Rewind is built to deploy on [Vercel](https://vercel.com/):

1. Push your fork/clone to GitHub.
2. Import the repository in Vercel.
3. Add the environment variables from [`.env.example`](./.env.example) in the Vercel project
   dashboard (**Settings → Environment Variables**) — at minimum `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`.
4. Add `https://<your-domain>/auth/confirm` to the Supabase **Redirect URLs**, otherwise magic
   links will refuse to come back to your deployment.
5. Deploy. Vercel will run `npm run build` automatically.

## Contributing

Contributions are welcome. To propose a change:

1. Open an issue describing the bug or feature.
2. Fork the repo and create a branch for your change.
3. Make sure `npm run lint`, `npm run typecheck` and `npm test` pass.
4. Open a pull request describing what changed and why.

## License

Licensed under the [MIT License](./LICENSE) — Copyright (c) 2026 Sebastiano (skebby11).

## Acknowledgements

Built with [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/),
[Recharts](https://recharts.org/), and [Supabase](https://supabase.com/).
