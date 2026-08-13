# Inventory, settings, and month-detail

**Date:** 2026-08-13
**Status:** Approved for planning
**App:** Rewind (`resell-dash`) — self-hosted reselling dashboard

## Problem

Four gaps in the current inventory workflow:

1. A sale to the United States cannot be recorded. `articoli.paese_vendita` only accepts the 27 EU member codes, and the Estero picker is that same hardcoded list. The repo is open source: the next installer may not be in Italy and must not be stuck with a compiled-in country list.
2. New purchases still suggest four hardcoded categories (`Videogiochi`, `Console`, `Controller`, `Accessori`). The owner wants a longer list (to be supplied) and every installer must be able to add, rename, and delete categories from Impostazioni.
3. The dashboard already has a monthly chart and a monthly totals table, but the only “detail” is a sold-item count plus revenue/profit. The owner does not trust that count without seeing how it is built (costs, fees, shipping, and the actual items).
4. There is no way to remove a junk purchase from Articoli. Sold history must not be hard-deleted (it feeds KPIs, month totals, and Vendite UE).

## Goals

- Record extra-EU destinations (starting with the United States) without mixing them into the EU-27 compliance total.
- Make countries and categories per-install data, edited in Impostazioni, so a clone works without a code change.
- Show each month as a reconcilable statement: richer totals plus the list of items that produced them.
- Hard-delete unsold inventory rows; archive sold rows so they leave the default Articoli list but stay in every total.

## Non-goals

- Translating the UI or renaming stored `destinazione` values (`Italia` / `Estero`). The app stays Italian; those two strings keep meaning “home country” / “abroad”.
- Editing purchase date, cost, or source after creation (still a README gap).
- Deleting a catalog model (`prodotti`). This spec only removes or archives a physical item (`articoli`).
- Voice entry, PriceCharting, or any new barcode source.
- Multi-tenant / per-user country lists. The app is still single-install; RLS stays “allowlisted email can see every row”.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Countries | New `paesi` table, managed in Impostazioni. Seed EU-27 (`ue = true`) + Stati Uniti (`US`, `ue = false`). |
| Home country | `impostazioni.chiave = 'paese_origine'`, default `IT`. Destinazione `Italia` writes this code; Estero lists every *active* country except home. |
| Country delete | Blocked while any `articoli.paese_vendita` equals that code, and blocked while the code is `paese_origine`. **Code is immutable after insert**; only `nome`, `ue`, `attivo`, `ordine` change. |
| Categories | New `categorie` table, managed in Impostazioni. `prodotti.categoria` stays free text (same pattern as `canali`). |
| Category delete | Blocked while any `prodotti.categoria` equals that name (case-insensitive). Rename always updates matching products. |
| Category seed | Current four names, same order. Owner will send a longer list before or during implementation; if it arrives, seed that list instead (and upsert any of the four already present after a previous seed). |
| Month detail | Keep the existing chart. Enrich the monthly table (cost of goods, fees, shipping). Clicking a month opens that month’s sold items. |
| What “sold” means | Unchanged: `stato in ('venduto', 'consegnato')` and `data_vendita` in range. One physical item = one sale. Archived items still count. |
| Unsold delete | Hard `DELETE` from `articoli` only when `stato` is `acquistato` or `in vendita`. Confirm in the row menu. |
| Sold archive | `archiviato_at timestamptz`. Hidden on Articoli by default, still in KPIs / month detail / Vendite UE. Filter to show and unarchive. |

---

## 1. Configurable countries

### Schema

New table `paesi`:

| Column | Type | Notes |
|---|---|---|
| `codice` | `text` PK | ISO 3166-1 alpha-2, stored uppercase. `check (codice ~ '^[A-Z]{2}$')`. |
| `nome` | `text` not null | Display name, 1–60 chars after trim. Unique on `lower(nome)`. |
| `ue` | `boolean` not null default false | Member of the EU-27 set used by Vendite UE. Not inferred from the code. |
| `attivo` | `boolean` not null default true | Hidden from new-sale pickers when false. Historical rows keep the code. |
| `ordine` | `integer` not null default 0 | Picker order, admin-controlled (same as `canali`). |
| `created_at` | `timestamptz` not null default now() | |

RLS, grants, and `utente_autorizzato()` policies match `canali` (`0002` / `0006` / `0013`): `authenticated` + allowlist, `anon` revoked.

Seed (ordine = current `PAESI_UE` order, then `US` last):

- 27 EU members with `ue = true` and the Italian names already in `src/types/index.ts`.
- `US` / `Stati Uniti` / `ue = false`.

`impostazioni`: insert `chiave = 'paese_origine'`, `valore = '"IT"'` (jsonb string) if missing.

### `articoli.paese_vendita`

- Drop `articoli_paese_vendita_valido` (the hardcoded EU-27 CHECK).
- Add `articoli.paese_vendita` → `paesi.codice` FK, `ON DELETE RESTRICT`, still nullable.
- Replace `articoli_paese_destinazione_coerenti` so it no longer names `IT`:

```
paese_vendita is null
or (destinazione = 'Italia')
or (destinazione = 'Estero')
```

Coherence with *home* is **not** a CHECK. A CHECK that reads `impostazioni` would break existing rows the moment someone changes home country. Write-time validation owns that invariant (below). Changing `paese_origine` does **not** rewrite historical `destinazione` / `paese_vendita`.

Existing `IT` rows stay valid: `IT` is in the seed. No backfill of `US`.

### Write-time rules (`parseVendita`)

`risolviPaeseVendita` today hardcodes `Italia → IT` and “code ∈ `PAESI_UE` \ {IT}”. Replace with:

- `destinazione = 'Italia'` → `paese_vendita = paese_origine` (from Impostazioni; default `IT` if the key is missing).
- `destinazione = 'Estero'` → selected code, or `null` if unspecified (same “lacuna” as today). Reject the home code and any code not present in `paesi`.
- Anything else → `null`.

The server action loads the allowed codes (`paesi.codice`) and `paese_origine` and passes them into validation. Pure `parseVendita` in `validazione.ts` must take those as arguments (or a small context object) so tests do not need a database. Do **not** keep importing `PAESI_UE` as the allowlist.

`PAESI_UE` / `nomePaese` in `src/types/index.ts` remain only as the seed source and as a fallback label if a leftover code is not in the loaded map. Runtime pickers and `/vendite-ue` labels read `paesi`.

### Impostazioni UI

New “Paesi” section, same interaction model as Canali (`CanaliManager`):

- List: flag/code, name, `UE` badge, article count, active toggle, up/down, rename, delete.
- Add: ISO code (normalized to uppercase, exactly two A–Z), name, `ue` checkbox.
- Delete disabled (with count) when `conteggioArticoli > 0`, and disabled when the row is the current `paese_origine` (change home first).
- Rename: change `nome` only. **Code is immutable after insert** (`nome`, `ue`, `attivo`, `ordine` are the only editable fields). A wrong code is a new row, not a rewrite of `articoli` / `paese_origine`.
- Home country: a select of active countries at the top of the section. Saving updates `impostazioni.paese_origine`.

### Sale dialog

- Destinazione stays Italia / Estero.
- Estero picker: active `paesi` where `codice <> paese_origine`, including Stati Uniti. Label becomes “Paese” (not “Paese UE”).
- Placeholder unchanged: unspecified is allowed and is the Vendite UE lacuna.

### Vendite UE

The page stays the EU compliance view for installers who care about OSS. It must not treat the United States as an EU member.

`v_vendite_per_paese_anno` can stay grouped by `paese_vendita` + `destinazione`. Mapping in `getVenditePerPaeseAnno` changes:

- Load `paesi` (`codice`, `nome`, `ue`) and `paese_origine`.
- A row whose `paese` has `ue = true` and `paese <> paese_origine` contributes to **Totale UE (esclusa [home name])**.
- A row whose `paese` has `ue = false` (US today) is listed with the others but **excluded** from that EU total. Show a second footer **Extra UE** when any such row exists (count, revenue, profit).
- “Senza paese / Estero” and “destinazione sconosciuta” stay as they are (min–max interval for “fuori home”).
- `nomePaese` uses the `paesi.nome` map.

Italy (or whatever home is) still appears as its own country row when present; it is not inside the EU-ex-home total.

Nav label and route (`/vendite-ue`) stay. No new page.

### Import

`scripts/import-csv.ts` / incrementale: a sheet country that is not in `paesi` must not be written (leave `paese_vendita` null and report an anomaly). Do not auto-insert countries from a CSV. The sheet value `Italia` (or the home-country display name) resolves to `paese_origine`, same rule as `parseVendita` — not a hardcoded `IT`.

---

## 2. Configurable categories

### Schema

New table `categorie`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `nome` | `text` not null | 1–60 chars. Unique on `lower(nome)`. |
| `attivo` | `boolean` not null default true | Hidden from the new-purchase datalist when false. |
| `ordine` | `integer` not null default 0 | |
| `created_at` | `timestamptz` not null default now() | |

Same RLS/grants as `canali`.

`prodotti.categoria` stays `text`. No FK. Reasons: IGDB still writes `"Videogiochi"` as a string; the importer and historical rows already store free text; a missing/inactive category must not make a product unreadable.

Seed, unless the owner has already sent a replacement list:

1. Videogiochi
2. Console
3. Controller
4. Accessori

If a longer list arrives before implementation, that list is the seed. Existing product strings that match a seed name keep working with no UPDATE.

### Impostazioni UI

New “Categorie” section, clone of Canali (minus `tipo`):

- Add, rename, activate/deactivate, reorder, delete.
- Each row shows `conteggioProdotti` (exact name match on `prodotti.categoria`).
- Delete is disabled while `conteggioProdotti > 0`. Message: “Riassegna o svuota la categoria sui N modelli prima di eliminarla.”
- Rename **always** updates `prodotti.categoria` where the old name matches (case-insensitive match, write the new canonical spelling). No “aggiorna storico” checkbox: unlike channels, the category *is* the product field, and leaving orphans would immediately block delete forever.

### Inserimento

- Datalist (or select-with-custom) reads `getCategorieAttive()`, not `CATEGORIE`.
- Free text remains accepted on save (same as today) so a barcode/IGDB suggestion that is not in the table still stores. Implementation **also** upserts that name into `categorie` (attivo, in coda) so the next visit shows it in Impostazioni. If unique-index conflict, reuse the existing row.

`CATEGORIE` in `src/types/index.ts` survives only as the seed source / mock-data examples, with the same comment style already used for `PIATTAFORME_VENDITA`.

### Dashboard donut

`dashboard_distribuzione_categoria` is unchanged (groups `prodotti.categoria`). Rename updates products, so slices follow the new name.

---

## 3. Month detail on the dashboard

### What is already there

`/` already renders:

- Combo chart: bars = `numeroVendite`, line = `totaleVendite`.
- Table: month, count, average price, revenue, profit.

`dashboard_vendite_mensili` only returns those four measures, only for sold/delivered items, grouped by `date_trunc('month', data_vendita)`. Months with zero sales are omitted.

That definition is **kept**. The mistrust comes from not seeing the parts, not from a wrong filter.

### Richer monthly totals

Extend `dashboard_vendite_mensili` (same `p_da` / `p_a`, same grain) with:

| New column | Definition |
|---|---|
| `costo_merci` | `sum(costo_acquisto)` |
| `fee_totali` | `sum(coalesce(fee, 0))` |
| `spedizione_totale` | `sum(coalesce(costo_spedizione, 0))` |

`profitto_totale` remains the generated-column sum (already `prezzo - costo - fee - spedizione`). The new columns exist so a row can be checked: `totale_vendite - costo_merci - fee_totali - spedizione_totale` equals `profitto_totale` (within rounding).

`v_vendite_mensili` is a thin wrapper. `CREATE OR REPLACE FUNCTION` **cannot** add `RETURNS TABLE` columns: `0016` must `DROP` `v_vendite_mensili` and `dashboard_vendite_mensili` (and their grants) and recreate them. Then recreate the view.

`VenditaMensile` and `getDatiDashboard` grow the same three fields. The existing chart does not change (still count + revenue). The table adds three numeric columns: Costo merce, Fee, Spedizione, before Profitto.

### Item list for a month

Clicking a month row (or a “Dettaglio” control on that row) opens a dialog/sheet titled with `meseLabel`.

Contents: sold/delivered items whose `data_vendita` falls in the **intersection** of that calendar month and the dashboard period `?da=&a=` (the same clip `dashboard_vendite_mensili` already applies). Include archived. Columns: product name, sale date, price, platform, fee, shipping, profit. Footer repeats the **same clipped totals as the table row**, so the list and the row match on a custom mid-month period.

Data access: one archive flag on `getArticoliPaginati` — `archivio: 'attivi' | 'archivio' | 'tutti'`, default `'attivi'`. The month dialog and the Vendite UE `?paese=mancante` deep link pass `'tutti'`. Also accept optional `da` / `a` on `data_vendita` (sold states only when a date range is set). Do not load the whole inventory into the client.

If a month has more than `ARTICOLI_PER_PAGINA` (50) sales, paginate inside the dialog.

Empty month: cannot happen from the table (only months with sales are listed).

Period filter on `/` still applies: only months that intersect `?da=&a=` appear, same as today.

---

## 4. Delete unsold / archive sold

### Schema

```
alter table articoli
  add column archiviato_at timestamptz;

comment on column articoli.archiviato_at is
  'Non null = nascosto dalla lista Articoli di default. Resta in KPI, andamento mensile e Vendite UE. Solo venduto/consegnato.';
```

Partial index for the default list:

```
create index idx_articoli_non_archivio
  on articoli (data_acquisto desc, id)
  where archiviato_at is null;
```

No CHECK forcing `archiviato_at` only on sold rows: the server action refuses the other case with a readable error. A CHECK would also block a future “unarchive then undo sale” if we cleared the timestamp first in the wrong order.

Dashboard RPCs and `v_vendite_per_paese_anno` do **not** filter on `archiviato_at`.

### Articoli list

- Default: `archiviato_at is null`.
- `?archivio=1` shows only archived rows (and the Filtri bar has a control to switch). Combined with `stato` / `q` / `paese=mancante` as AND filters. `paese=mancante` still means sold/delivered with null country — the Vendite UE deep link uses `archivio: 'tutti'` so a hidden lacuna is still fixable.
- Row menu (`AzioniStato`):
  - Unsold (`acquistato` / `in vendita`): **Elimina** (destructive). First click arms confirm (“Confermi? Elimina dall'inventario”); second click deletes. Same two-step pattern as “Annulla vendita”.
  - Sold (`venduto` / `consegnato`) and not archived: **Archivia**. One click is enough (reversible).
  - Archived: **Ripristina** (sets `archiviato_at` null).
- Sold rows never show Elimina. Unsold rows never show Archivia.

### Server actions (`articoli/actions.ts`)

- `eliminaArticolo(id)`: load stato; reject if not `acquistato`/`in vendita`; `delete`. Revalidate `/`, `/articoli`. After delete, if that was the product’s last article, leave the `prodotti` row (ON DELETE RESTRICT is the other way around — articles reference products — so this is safe). Optionally refresh catalog averages only if we later expose `ricalcola_prezzi_medi` to authenticated; **do not** grant that function to `authenticated` in this work (it is service-role on purpose). Unsold delete does not change `prezzo_medio_vendita`; it does change `prezzo_medio_acquisto`. Accept stale averages until the next import/seed, **or** compute the single product’s averages inline in the action with a normal `update` the caller is already allowed to run. Prefer the inline single-product update so Catalogo does not lie after deleting a purchase.
- `archiviaArticolo(id)` / `ripristinaArticolo(id)`: reject if not sold/delivered; set / clear `archiviato_at`. Revalidate `/articoli` only (totals do not change).

### Catalogo

No delete button on catalog cards.

---

## Error handling

- Duplicate country code / category name → `23505` → the same style of Italian message Canali already uses.
- Invalid ISO code → rejected in `parseNome`/`parseCodicePaese` before insert.
- Delete country or category still referenced → disabled in UI **and** rejected in the action (count re-checked; FK on `paesi` is the last net).
- Delete sold article / archive unsold article → action error, toast, no write.
- Missing `paese_origine` → treat as `IT` (or the first active country if `IT` was deleted — deletion of home is blocked while it is `paese_origine`; changing home is required first).
- Dashboard RPC failure → existing `erroreLettura` (no page of zeros).

## Testing

Unit tests (Vitest, no database), extend existing files:

- `validazione.test.ts`: `Italia` → home code (not hardcoded IT); Estero + `US` accepted when `US` is in the provided set; home code rejected on Estero; unknown code rejected; empty Estero country still ok.
- `periodo` / dashboard mappers: new monthly fields map and default to 0.
- `import-incrementale.test.ts`: unknown country code does not invent a paese.
- New helper tests for “may delete / may archive” pure predicates if they live outside the action.

No new browser e2e in this spec (the repo has none).

## Implementation notes (for the plan)

- Imperative migrations: next files `0014_…` (countries + home + FK), `0015_…` (categories), `0016_…` (month function columns), `0017_…` (`archiviato_at`). Split so each is revertible.
- Follow `canali` for RLS, unique `lower(nome)`, and Impostazioni UI. Do not introduce a fourth parallel widget system.
- Next.js 16: keep `searchParams` async; do not add `middleware.ts`.
- Generated `src/types/database.ts` must be updated with the new tables/columns/RPC shape.
- README: countries/categories in Settings; US as extra-EU; archive vs delete; month-detail columns. Roadmap line about “no delete” goes away.

## Open input (does not block planning)

- Owner will send the full category list. Plan seeds the current four and treats a longer list as a one-line seed change.
