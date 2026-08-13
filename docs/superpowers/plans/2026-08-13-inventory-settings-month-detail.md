# Inventory, settings, and month-detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurable countries and categories in Impostazioni, richer monthly dashboard totals with a per-month item list, hard-delete for unsold articles, and archive for sold ones.

**Architecture:** Follow the `canali` pattern (table + RLS allowlist + Impostazioni manager + datalist/select from active rows). Country and sale-country validation become pure functions that take a `{ paeseOrigine, codiciAmmessi }` context so tests stay DB-free. Dashboard month detail extends the existing `dashboard_vendite_mensili` RPC and opens a dialog that reuses `getArticoliPaginati` with a date range. Archive is a nullable `archiviato_at` on `articoli`, never a fifth stato.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase Postgres (imperative migrations `0014`–`0017`), Vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-13-inventory-settings-month-detail-design.md`

**Skills:** @supabase @supabase-postgres-best-practices — RLS on every new table, `security_invoker` views, `TO authenticated` + `utente_autorizzato()`, never grant `ricalcola_prezzi_medi` to authenticated. Next.js 16: `searchParams` is async; do not add `middleware.ts`.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/validazione.ts` | Pure parse for vendita (with country context), ISO codes, category names, delete/archive predicates |
| `src/lib/validazione.test.ts` | Unit tests for the above |
| `src/lib/data/periodo.ts` | `intervalloMeseNelPeriodo` — clip a calendar month to `?da=&a=` |
| `src/lib/data/periodo.test.ts` | Tests for that clip |
| `src/lib/data/queries.ts` | Reads: paesi, paese_origine, categorie, articoli filters (`archivio`, sale-date range) |
| `src/lib/data/mappers.ts` | Map `archiviato_at`; map new monthly columns |
| `src/types/index.ts` | `Paese`, `Categoria`, `VenditaMensile` extras, `Articolo.archiviatoAt`; `PAESI_UE`/`CATEGORIE` become seed-only |
| `src/types/database.ts` | Hand-update tables/RPC (same style as today; regenerate later if CLI is linked) |
| `supabase/migrations/0014_paesi_configurabili.sql` | `paesi`, home-country setting, drop EU CHECK, add FK |
| `supabase/migrations/0015_categorie_configurabili.sql` | `categorie` + count view |
| `supabase/migrations/0016_vendite_mensili_dettaglio.sql` | DROP/recreate monthly function + view with cost/fee/shipping |
| `supabase/migrations/0017_articoli_archivio.sql` | `archiviato_at` + partial index |
| `src/app/(dashboard)/impostazioni/actions.ts` | CRUD paesi/categorie + set home country |
| `src/app/(dashboard)/impostazioni/page.tsx` | New Paesi and Categorie sections |
| `src/components/dashboard/paesi-manager.tsx` | Settings widget for countries |
| `src/components/dashboard/categorie-manager.tsx` | Settings widget for categories |
| `src/app/(dashboard)/articoli/actions.ts` | `parseVendita` context; `eliminaArticolo`, `archiviaArticolo`, `ripristinaArticolo` |
| `src/app/(dashboard)/articoli/vendita-dialog.tsx` | Estero picker from `paesi`, label “Paese” |
| `src/app/(dashboard)/articoli/azioni-stato.tsx` | Delete / archive / restore |
| `src/app/(dashboard)/articoli/filtri.tsx` | Archive toggle |
| `src/app/(dashboard)/articoli/page.tsx` | Pass `archivio`, countries into table/dialog |
| `src/app/(dashboard)/articoli/articoli-table.tsx` | Thread `paesi` + `paeseOrigine` into vendita dialog |
| `src/app/(dashboard)/inserimento/*` | Category datalist from DB; upsert unknown category on save |
| `src/app/(dashboard)/page.tsx` | Extra monthly columns + month-detail trigger |
| `src/app/(dashboard)/vendite-ue/page.tsx` | Extra-UE footer; labels from `paesi` |
| `src/components/dashboard/dettaglio-mese.tsx` | Dialog: items for one clipped month |
| `scripts/import-csv.ts` | `Italia` → `paese_origine` |
| `README.md` | Settings countries/categories; archive vs delete; month columns |

Do **not** restructure `canali-manager.tsx`. Clone its interaction model into the two new managers.

---

### Task 1: Country-aware `parseVendita` (TDD)

**Files:**
- Modify: `src/lib/validazione.ts`
- Test: `src/lib/validazione.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the `parseVendita — paese di vendita` block. `parseVendita` must take a second argument:

```ts
export interface ContestoPaese {
  paeseOrigine: string;
  codiciAmmessi: ReadonlySet<string>;
}
```

Helper in the test file:

```ts
const CTX_IT: ContestoPaese = {
  paeseOrigine: "IT",
  codiciAmmessi: new Set([...PAESI_UE.map((p) => p.codice), "US"]),
};

function vendita(campi: Record<string, string>, ctx: ContestoPaese = CTX_IT) {
  return parseVendita(fd(campi), ctx);
}
```

Cases (keep the existing `base` object):

1. `destinazione: Italia` → `paeseVendita === ctx.paeseOrigine` even if the client sends `FR`.
2. Same with `ctx = { paeseOrigine: "DE", codiciAmmessi: CTX_IT.codiciAmmessi }` → `"DE"`.
3. Estero + `FR` accepted.
4. Estero + `US` accepted.
5. Estero without country → `null`, ok.
6. Estero + `GB` (not in set) → campo `paese_vendita` /non valido/.
7. Estero + home code (`IT` with `CTX_IT`) → /non valido/.
8. No destinazione → both null.
9. Estero + every `PAESI_UE` except home still accepted.
10. Existing callers of `parseVendita` in this file that are **not** about paese must pass `CTX_IT` or the tests will not compile — update those call sites in this same step.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/validazione.test.ts`

Expected: FAIL — `parseVendita` still has one argument and still hardcodes `IT` / `PAESI_UE` (home-DE case returns `IT`; `US` rejected).

- [ ] **Step 3: Implement**

In `src/lib/validazione.ts`:

- Remove `const CODICI_PAESI_UE` and the `PAESI_UE` import (keep `STATI_ARTICOLO`, `TIPI_CANALE`).
- Export `ContestoPaese`.
- Change `risolviPaeseVendita` to take `ctx`:

```ts
function risolviPaeseVendita(
  destinazione: string | null,
  paeseRaw: string | null,
  ctx: ContestoPaese
): { paeseVendita: string | null; errore?: string } {
  if (destinazione === "Italia") return { paeseVendita: ctx.paeseOrigine };
  if (destinazione === "Estero") {
    if (!paeseRaw) return { paeseVendita: null };
    const codice = paeseRaw.toUpperCase();
    if (codice !== ctx.paeseOrigine && ctx.codiciAmmessi.has(codice)) {
      return { paeseVendita: codice };
    }
    return { paeseVendita: null, errore: "Paese non valido." };
  }
  return { paeseVendita: null };
}
```

- `parseVendita(formData, ctx: ContestoPaese)` passes `ctx` into `risolviPaeseVendita`.
- Update the JSDoc: Italia → home country, not hardcoded `IT`.

Also add these pure helpers in the same file (tests in Step 1 can live in a new `describe`):

```ts
export function parseCodicePaese(raw: string): string | undefined {
  const codice = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(codice) ? codice : undefined;
}

export function parseNomeEtichetta(raw: string): string | undefined {
  const nome = raw.trim().replace(/\s+/g, " ");
  if (!nome || nome.length > 60) return undefined;
  return nome;
}

export function puoEliminareArticolo(stato: StatoArticolo): boolean {
  return stato === "acquistato" || stato === "in vendita";
}

export function puoArchiviareArticolo(stato: StatoArticolo, archiviato: boolean): boolean {
  return (stato === "venduto" || stato === "consegnato") && !archiviato;
}
```

`parseNomeCanale` can delegate to `parseNomeEtichetta` (same rules) to stay DRY.

Tests for helpers:

- `parseCodicePaese("us") === "US"`; `"U"`, `"USA"`, `"u1"` → undefined.
- `puoEliminareArticolo("acquistato"|"in vendita")` true; sold/delivered false.
- `puoArchiviareArticolo("venduto", false)` true; `("venduto", true)` false; `("acquistato", false)` false.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/validazione.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/validazione.ts src/lib/validazione.test.ts
git commit -m "feat(validazione): country context for sales and archive predicates"
```

---

### Task 2: Clip a month to the dashboard period (TDD)

**Files:**
- Modify: `src/lib/data/periodo.ts`
- Test: `src/lib/data/periodo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { intervalloMeseNelPeriodo } from "./periodo";

it("senza periodo restituisce il mese di calendario intero", () => {
  expect(intervalloMeseNelPeriodo("2026-03", {})).toEqual({
    da: "2026-03-01",
    a: "2026-03-31",
  });
});

it("febbraio non bisestile finisce il 28", () => {
  expect(intervalloMeseNelPeriodo("2026-02", {}).a).toBe("2026-02-28");
});

it("interseca un periodo a metà mese", () => {
  expect(intervalloMeseNelPeriodo("2026-03", { da: "2026-03-10", a: "2026-03-20" })).toEqual({
    da: "2026-03-10",
    a: "2026-03-20",
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/data/periodo.test.ts`

Expected: FAIL — `intervalloMeseNelPeriodo` is not exported.

- [ ] **Step 3: Implement**

```ts
export function intervalloMeseNelPeriodo(mese: string, periodo: Periodo): Required<Periodo> {
  const [anno, m] = mese.split("-").map(Number);
  const inizio = `${mese}-01`;
  const ultimo = new Date(Date.UTC(anno, m, 0)).getUTCDate();
  const fine = `${mese}-${String(ultimo).padStart(2, "0")}`;
  const da = periodo.da && periodo.da > inizio ? periodo.da : inizio;
  const a = periodo.a && periodo.a < fine ? periodo.a : fine;
  return { da, a };
}
```

`mese` is `YYYY-MM` (same as `VenditaMensile.mese`).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/periodo.ts src/lib/data/periodo.test.ts
git commit -m "feat(dashboard): clip month detail to the active period"
```

---

### Task 3: Migration 0014 — configurable countries

**Files:**
- Create: `supabase/migrations/0014_paesi_configurabili.sql`
- Modify: `src/types/database.ts` (add `paesi` table; `articoli.paese_vendita` Relationships)
- Modify: `src/types/index.ts` (add `Paese` interface; comment that `PAESI_UE` is seed-only, like `PIATTAFORME_VENDITA`)

@supabase @supabase-postgres-best-practices

- [ ] **Step 1: Write the migration**

Follow `0013_canali_configurabili.sql` for RLS/grants. Exact shape:

```sql
create table if not exists paesi (
  codice text primary key check (codice ~ '^[A-Z]{2}$'),
  nome text not null check (length(trim(nome)) > 0 and length(nome) <= 60),
  ue boolean not null default false,
  attivo boolean not null default true,
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_paesi_nome on paesi (lower(nome));
create index if not exists idx_paesi_attivo_ordine on paesi (attivo, ordine);

alter table paesi enable row level security;
revoke all on paesi from anon;
grant select, insert, update, delete on paesi to authenticated;

create policy paesi_select_autorizzati on paesi
  for select to authenticated using ((select utente_autorizzato()));
-- insert / update (USING + WITH CHECK) / delete: same predicate
```

Seed: insert all 27 `PAESI_UE` rows with `ue = true` in the current array order (`ordine` 0..26), then `('US', 'Stati Uniti', false, true, 27)`.

```sql
insert into impostazioni (chiave, valore)
values ('paese_origine', '"IT"'::jsonb)
on conflict (chiave) do nothing;
```

(`impostazioni.chiave` is unique.)

```sql
alter table articoli drop constraint if exists articoli_paese_vendita_valido;

alter table articoli drop constraint if exists articoli_paese_destinazione_coerenti;
alter table articoli
  add constraint articoli_paese_destinazione_coerenti check (
    paese_vendita is null
    or destinazione = 'Italia'
    or destinazione = 'Estero'
  );

alter table articoli
  add constraint articoli_paese_vendita_fkey
  foreign key (paese_vendita) references paesi (codice)
  on delete restrict;
```

Comment on table/columns matching the spec.

- [ ] **Step 2: Update `src/types/database.ts` by hand**

Add `paesi` under `Tables` with Row/Insert/Update (`codice`, `nome`, `ue`, `attivo`, `ordine`, `created_at`). Add `Relationships` on `articoli` for `paese_vendita` → `paesi.codice` if that array is used; if current `articoli.Relationships` is empty, add the FK entry in the same style as `prodotto_id` if one exists — otherwise leave Relationships empty (this file already leaves some empty). Do not invent a regenerate command if the CLI is not linked.

- [ ] **Step 3: Add domain type**

In `src/types/index.ts`:

```ts
export interface Paese {
  codice: string;
  nome: string;
  ue: boolean;
  attivo: boolean;
  ordine: number;
  conteggioArticoli: number;
}
```

Update the `PAESI_UE` comment: seed + mock only; runtime source is `paesi`. Keep `nomePaese` as fallback (`map.get(codice) ?? codice`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_paesi_configurabili.sql src/types/database.ts src/types/index.ts
git commit -m "feat(db): configurable countries table and sale-country FK"
```

Apply the migration on the linked project when implementing (Supabase SQL editor or `supabase db push`). Do not invent `apply_migration` via MCP unless the agent has a working Supabase MCP.

---

### Task 4: Queries + settings CRUD for countries

**Files:**
- Modify: `src/lib/data/queries.ts`
- Modify: `src/app/(dashboard)/impostazioni/actions.ts`
- Create: `src/components/dashboard/paesi-manager.tsx`
- Modify: `src/app/(dashboard)/impostazioni/page.tsx`

- [ ] **Step 1: Queries**

```ts
export async function getPaeseOrigine(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("impostazioni")
    .select("valore")
    .eq("chiave", "paese_origine")
    .maybeSingle();
  if (error) erroreLettura("paese origine", error.message);
  const v = data?.valore;
  return typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : "IT";
}

export async function getPaesi(): Promise<Paese[]> { /* all, order ordine,nome */ }
export async function getPaesiAttivi(): Promise<Paese[]> { /* attivo = true */ }
```

`getPaesi` must include `conteggioArticoli`. Prefer a view `v_conteggio_paesi` (`paese_vendita`, `count(*)`) added at the end of `0014` if not already there — if `0014` is already committed without it, add the view in a follow-up statement in `0014` only if that migration has **not** been applied yet; otherwise a tiny `0014b` is worse than querying counts in JS. **Do this:** add to `0014` before first apply:

```sql
create or replace view v_conteggio_paesi
  with (security_invoker = true) as
select paese_vendita as codice, count(*)::int as conteggio
from articoli
where paese_vendita is not null
group by paese_vendita;
```

Grant select on the view to `authenticated`.

Also export a small helper used by sale actions:

```ts
export async function getContestoPaese(): Promise<ContestoPaese> {
  const [origine, paesi] = await Promise.all([getPaeseOrigine(), getPaesi()]);
  return {
    paeseOrigine: origine,
    codiciAmmessi: new Set(paesi.map((p) => p.codice)),
  };
}
```

- [ ] **Step 2: Actions** in `impostazioni/actions.ts`

Mirror canali. New functions:

- `creaPaese(stato, formData)` — `parseCodicePaese`, `parseNomeEtichetta`, `ue` checkbox, ordine = max+1. `23505` → Italian duplicate message.
- `rinominaPaese` — **nome / ue / attivo only**. Never update `codice`. Identity is `codice` (`IT`), **not** a UUID. Do not copy `UUID_RE` from canali into paese actions.
- `impostaAttivoPaese(codice)`, `spostaPaese(codice)` — same, key by `codice`.
- `eliminaPaese(codice)` — reject if count > 0 or codice === `paese_origine`. Then `delete`.
- `impostaPaeseOrigine(codice)` — must exist and be attivo. `impostazioni` PK is `id`; uniqueness is on `chiave`. Use `.upsert({ chiave: 'paese_origine', valore: JSON.stringify(codice) }, { onConflict: 'chiave' })` or `update().eq('chiave', 'paese_origine')` (0014 already inserts the row).

`rivalidaPagine` also `revalidatePath("/vendite-ue")`.

- [ ] **Step 3: `PaesiManager` UI**

Clone `canali-manager.tsx` interaction (useActionState, toasts, no useEffect-on-seq). Differences:

- Add form fields: codice (2 letters), nome, checkbox UE.
- Row shows `codice`, nome, UE badge, count, active, up/down, rename (nome only), delete (disabled + title when count > 0 or is home).
- Top of section: `<Select>` of active countries for home, form → `impostaPaeseOrigine`.

- [ ] **Step 4: Impostazioni page**

New section “Paesi” above or below Canali, copy the Canali card chrome. Load `getPaesi()` + `getPaeseOrigine()` in the existing `Promise.all`.

- [ ] **Step 5: Commit (do not typecheck yet)**

`parseVendita` now requires `ctx`; the only production caller is still `articoli/actions.ts` and is wired in Task 5. `tsc` will fail until then — that is expected.

```bash
git add src/lib/data/queries.ts src/app/\(dashboard\)/impostazioni src/components/dashboard/paesi-manager.tsx supabase/migrations/0014_paesi_configurabili.sql
git commit -m "feat(settings): manage countries and home country"
```

---

### Task 5: Sale dialog, Vendite UE extra-EU, import home country

**Files:**
- Modify: `src/app/(dashboard)/articoli/actions.ts` — `registraVendita` loads `getContestoPaese()` then `parseVendita(formData, ctx)`
- Modify: `src/app/(dashboard)/articoli/vendita-dialog.tsx`
- Modify: `src/app/(dashboard)/articoli/page.tsx` + `articoli-table.tsx` — pass `paesi` + `paeseOrigine`
- Modify: `src/lib/data/queries.ts` — `getVenditePerPaeseAnno` takes paesi + home
- Modify: `src/types/index.ts` — `VenditaPerPaeseAnno.extraUe: SubtotaleVendite`
- Modify: `src/app/(dashboard)/vendite-ue/page.tsx`
- Modify: `scripts/import-csv.ts` — `destinazionePaese(raw, paeseOrigine)`

- [ ] **Step 1: Wire `registraVendita`**

```ts
const ctx = await getContestoPaese();
const esito = parseVendita(formData, ctx);
```

- [ ] **Step 2: Vendita dialog**

Props: `paesi: Paese[]`, `paeseOrigine: string` instead of importing `PAESI_UE`.

```ts
const paesiEsteri = paesi.filter((p) => p.attivo && p.codice !== paeseOrigine);
```

Label: `Paese` (not `Paese UE`). Map `p.nome`. Keep unspecified placeholder.

- [ ] **Step 3: Vendite UE mapping**

In `getVenditePerPaeseAnno`:

- Fetch `getPaesi()` + `getPaeseOrigine()` in parallel with the view.
- `mappaNomi` from paesi; `ueSet` = codes with `ue === true`.
- `righe` still all known countries (including US and home).
- `totaleUeEsclusaItalia` → rename field to `totaleUeEsclusaOrigine` **or** keep the property name and compute it as: sum of righe where `ueSet.has(paese) && paese !== origine`. Prefer **keeping the property** `totaleUeEsclusaItalia` in this task to limit churn; the page label becomes `Totale UE (esclusa ${nomeHome})`.
- New `extraUe: SubtotaleVendite` = sum of righe where paese is known and `!ueSet.has(paese)`.
- Labels: do **not** keep calling module-level `nomePaese()` from the page (US would stay `"US"`). Either attach `nome` on each riga in `getVenditePerPaeseAnno` or pass a `Map<string, string>` from paesi into the page.

Page: after country rows, if `extraUe.numeroVendite > 0` show a footer row “Extra UE” (not amber). EU total excludes those rows. Update the intro sentence only if needed.

- [ ] **Step 4: Import**

```ts
function destinazionePaese(
  raw: string,
  paeseOrigine: string
): { destinazione: string | null; paeseVendita: string | null } {
  const destinazione = testo(raw);
  if (destinazione === "Italia") return { destinazione, paeseVendita: paeseOrigine };
  return { destinazione, paeseVendita: null };
}
```

Load `paese_origine` once at the start of the import (service role client, same as other reads). Unknown codes never appear in this sheet mapping (estero stays null) — no auto-insert.

If `import-incrementale.test.ts` asserts `Italia → IT`, change the fixture to pass `paeseOrigine` through the transform or keep IT as the default origin so existing assertions stay true.

- [ ] **Step 5: Run `npx vitest run` and `npx tsc --noEmit` — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/articoli src/app/\(dashboard\)/vendite-ue src/lib/data/queries.ts src/types/index.ts scripts/import-csv.ts src/lib/import-incrementale.ts src/lib/import-incrementale.test.ts
git commit -m "feat(sales): configurable sale countries including extra-EU"
```

---

### Task 6: Migration 0015 + category settings + inserimento

**Files:**
- Create: `supabase/migrations/0015_categorie_configurabili.sql`
- Modify: `src/types/database.ts`, `src/types/index.ts` — **replace** the existing `export type Categoria = (typeof CATEGORIE)[number]` (a second `Categoria` identifier fails `tsc`). Use `interface Categoria { id, nome, attivo, ordine, conteggioProdotti }` and keep the const as seed-only.
- Modify: `src/lib/data/queries.ts`
- Modify: `src/app/(dashboard)/impostazioni/actions.ts`
- Create: `src/components/dashboard/categorie-manager.tsx`
- Modify: `src/app/(dashboard)/impostazioni/page.tsx`
- Modify: `src/app/(dashboard)/inserimento/page.tsx`, `inserimento-form.tsx`, `actions.ts`

- [ ] **Step 1: Migration**

Table `categorie` (`id uuid PK`, `nome`, `attivo`, `ordine`, `created_at`) — same checks/RLS as `canali` minus `tipo`. Unique `lower(nome)`. View `v_conteggio_categorie` on `prodotti.categoria`.

Seed (unless the owner has already sent a longer list — if they have, use that list instead):

```sql
insert into categorie (nome, ordine) values
  ('Videogiochi', 0),
  ('Console', 1),
  ('Controller', 2),
  ('Accessori', 3);
```

- [ ] **Step 2: Queries + actions**

`getCategorieAttive(): string[]` (nomi, ordine).
`getCategorieConConteggio(): Categoria[]` (`id`, `nome`, `attivo`, `ordine`, `conteggioProdotti`).

Actions: `creaCategoria`, `rinominaCategoria` (always `update prodotti set categoria = :nuovo where lower(categoria) = lower(:vecchio)`), `impostaAttivoCategoria`, `spostaCategoria`, `eliminaCategoria` (reject if count > 0).

- [ ] **Step 3: UI + inserimento**

`CategorieManager` — clone canali, no orphans section required (rename always updates products). Delete disabled when count > 0 with the spec message.

Inserimento page: `getCategorieAttive()` instead of `CATEGORIE`. Form datalist from that prop.

In `creaArticolo`, after a successful product insert (or when the form sent a non-empty categoria), upsert into `categorie`:

```ts
if (categoria) {
  const { error } = await supabase.from("categorie").insert({
    nome: categoria,
    ordine: /* max+1 or 0 */,
  });
  // 23505 = already exists: ignore
}
```

Do this even when the product already existed, so a newly typed name still appears in Settings.

Update `CATEGORIE` comment in `src/types/index.ts` to seed/mock only.

- [ ] **Step 4: `npx tsc --noEmit` + commit**

```bash
git commit -m "feat(settings): configurable product categories"
```

---

### Task 7: Richer monthly totals (SQL + table)

**Files:**
- Create: `supabase/migrations/0016_vendite_mensili_dettaglio.sql`
- Modify: `src/types/database.ts` (`dashboard_vendite_mensili` Returns)
- Modify: `src/types/index.ts` (`VenditaMensile`)
- Modify: `src/lib/data/queries.ts` (`getDatiDashboard` mapping)
- Modify: `src/app/(dashboard)/page.tsx` (table columns)

- [ ] **Step 1: Migration — DROP and recreate**

`CREATE OR REPLACE FUNCTION` cannot add `RETURNS TABLE` columns.

```sql
drop view if exists v_vendite_mensili;
drop function if exists dashboard_vendite_mensili(date, date);

create function dashboard_vendite_mensili(p_da date, p_a date)
returns table (
  mese date,
  numero_vendite bigint,
  prezzo_medio_vendita numeric,
  totale_vendite numeric,
  costo_merci numeric,
  fee_totali numeric,
  spedizione_totale numeric,
  profitto_totale numeric
)
language sql stable security invoker set search_path = ''
as $$
  select
    date_trunc('month', data_vendita)::date as mese,
    count(*) as numero_vendite,
    coalesce(avg(prezzo_vendita), 0) as prezzo_medio_vendita,
    coalesce(sum(prezzo_vendita), 0) as totale_vendite,
    coalesce(sum(costo_acquisto), 0) as costo_merci,
    coalesce(sum(coalesce(fee, 0)), 0) as fee_totali,
    coalesce(sum(coalesce(costo_spedizione, 0)), 0) as spedizione_totale,
    coalesce(sum(profitto), 0) as profitto_totale
  from public.articoli
  where stato in ('venduto', 'consegnato')
    and data_vendita is not null
    and (p_da is null or data_vendita >= p_da)
    and (p_a is null or data_vendita <= p_a)
  group by date_trunc('month', data_vendita)
  order by mese;
$$;

create view v_vendite_mensili
  with (security_invoker = true) as
select * from dashboard_vendite_mensili(null, null);

grant execute on function dashboard_vendite_mensili(date, date) to authenticated;
revoke all on function dashboard_vendite_mensili(date, date) from anon, public;
grant select on v_vendite_mensili to authenticated;
revoke all on v_vendite_mensili from anon;
```

Do **not** filter `archiviato_at` here (column does not exist yet; and spec says archived still count).

- [ ] **Step 2: Types + mapper**

```ts
export interface VenditaMensile {
  mese: string;
  meseLabel: string;
  numeroVendite: number;
  totaleVendite: number;
  prezzoMedio: number;
  costoMerci: number;
  feeTotali: number;
  spedizioneTotale: number;
  profitto: number;
}
```

Map with existing `num()`. Update `database.ts` Returns.

- [ ] **Step 3: Dashboard table**

Add columns Costo merce, Fee, Spedizione (right-aligned `font-mono-num`) before Profitto. Chart unchanged.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dashboard): monthly cost, fees, and shipping totals"
```

---

### Task 8: Month item-list dialog

**Files:**
- Modify: `src/lib/data/queries.ts` — `getArticoliPaginati` args
- Create: `src/app/(dashboard)/actions.ts` (`caricaVenditeMese` lives here, not in articoli/actions)
- Create: `src/components/dashboard/dettaglio-mese.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Extend `getArticoliPaginati`**

```ts
archivio?: "attivi" | "archivio" | "tutti"; // default "attivi" — applied in Task 9
daVendita?: string;  // ISO date on data_vendita — NOT `da`/`a`
aVendita?: string;
```

`getArticoliPaginati` already uses `(da, a)` as pagination offsets inside `eseguiPaginata`. Date filters must be named `daVendita` / `aVendita` and applied inside `base()`, or the callback will shadow the sale-date range.

When `daVendita` or `aVendita` is set, also force `stato in ('venduto','consegnato')` (in addition to other filters).

```
if (daVendita) query = query.gte("data_vendita", daVendita);
if (aVendita) query = query.lte("data_vendita", aVendita);
```

**Until Task 9**, `archiviato_at` does not exist. Implement the `da`/`a` filters now; add the `archivio` parameter in this task but **only apply it after 0017**. To avoid a broken select, do **not** reference `archiviato_at` until Task 9. In this task: add `da`/`a` only. Pass `archivio` in Task 9.

Order for the month dialog: `data_vendita` asc, then `id`. When `da`/`a` are set, use that order instead of `data_acquisto` desc.

- [ ] **Step 2: Server action**

```ts
"use server";
export async function caricaVenditeMese(mese: string, daPeriodo?: string, aPeriodo?: string, pagina = 1) {
  const clip = intervalloMeseNelPeriodo(mese, { da: daPeriodo, a: aPeriodo });
  return getArticoliPaginati({
    daVendita: clip.da,
    aVendita: clip.a,
    pagina,
    // Task 9: archivio: "tutti"
  });
}
```

Put it in `src/app/(dashboard)/actions.ts` (new file) so the dashboard client component can import it.

- [ ] **Step 3: `DettaglioMese` client component**

Dialog triggered from a “Dettaglio” button on each table row (and the row stays a `<tr>` — do not make the whole row a button). On open, call `caricaVenditeMese`. Table: nome, data vendita, prezzo, piattaforma, fee, spedizione, profitto. Footer: the month totals passed as props (the **clipped** numbers already on `VenditaMensile`). Paginate if `totale > 50`.

- [ ] **Step 4: Wire into `page.tsx`**

Pass `periodo` into the table section so the dialog clips correctly.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(dashboard): per-month sold-item detail dialog"
```

---

### Task 9: Archive sold / delete unsold

**Files:**
- Create: `supabase/migrations/0017_articoli_archivio.sql`
- Modify: `src/types/database.ts`, `src/types/index.ts` (`Articolo.archiviatoAt: string | null`)
- Modify: `src/lib/data/mappers.ts`
- Modify: `src/lib/data/queries.ts` (`SELECT_ARTICOLI` + `archivio` filter)
- Modify: `src/app/(dashboard)/articoli/actions.ts`
- Modify: `src/app/(dashboard)/articoli/azioni-stato.tsx`
- Modify: `src/app/(dashboard)/articoli/filtri.tsx`, `page.tsx`
- Modify: `src/app/(dashboard)/actions.ts` (`caricaVenditeMese` → `archivio: "tutti"`)
- Modify: `src/app/(dashboard)/vendite-ue/page.tsx` deep link → `/articoli?paese=mancante` already; page must pass `archivio: "tutti"` when `senzaPaese`

- [ ] **Step 1: Migration**

```sql
alter table articoli add column if not exists archiviato_at timestamptz;

comment on column articoli.archiviato_at is
  'Non null = nascosto dalla lista Articoli di default. Resta in KPI, andamento mensile e Vendite UE.';

create index if not exists idx_articoli_non_archivio
  on articoli (data_acquisto desc, id)
  where archiviato_at is null;
```

- [ ] **Step 2: Queries**

Add `archiviato_at` to `SELECT_ARTICOLI`. Default `archivio = "attivi"`. Apply the three-way filter from Task 8. `senzaPaese` (Vendite UE) uses `archivio: "tutti"`.

- [ ] **Step 3: Actions**

```ts
export async function eliminaArticolo(id: string): Promise<void> {
  // load stato + prodotto_id
  if (!puoEliminareArticolo(stato)) throw new Error("Si possono eliminare solo articoli non ancora venduti.");
  await supabase.from("articoli").delete().eq("id", id);
  // Inline recompute averages for that prodotto_id (authenticated update on prodotti):
  // prezzo_medio_acquisto = avg(costo_acquisto);
  // prezzo_medio_vendita = avg(prezzo_vendita) filter sold.
  // If no remaining articoli, set both averages to null.
  revalidatePath("/");
  revalidatePath("/articoli");
  revalidatePath("/catalogo");
}

export async function archiviaArticolo(id: string): Promise<void> { /* sold only; set now() */ }
export async function ripristinaArticolo(id: string): Promise<void> { /* sold only; set null */ }
```

Do **not** grant `ricalcola_prezzi_medi`.

- [ ] **Step 4: UI**

`AzioniStato`: unsold → two-step Elimina (clone Annulla vendita). Sold not archived → Archivia. Archived → Ripristina.

`Filtri`: add a link/tab “Archivio” → `?archivio=1`. Preserve `archivio=1` in every tab `href()`, in the GET search form (hidden input, same pattern as `stato`), and in `page.tsx` `hrefPagina`. When `archivio=1`, “Tutti” is not active.

`page.tsx`: `archivio` from `searchParams.archivio === "1" ? "archivio" : senzaPaese ? "tutti" : "attivi"`. An empty archive list is “Nessun articolo in archivio”, **not** the unfiltered “Magazzino vuoto” empty state (that state must require `archivio !== "archivio"`).

Add `archiviatoAt: null` to the `Articolo` literal(s) in `src/lib/mock-data.ts` or `tsc` fails.

- [ ] **Step 5: `npx vitest run` && `npx tsc --noEmit`**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(articoli): delete unsold items and archive sold ones"
```

---

### Task 10: README + leftover call sites

**Files:**
- Modify: `README.md` (features, settings, schema, project structure, roadmap “no delete”)
- Grep for leftover `PAESI_UE` / `CATEGORIE` runtime uses in `src/app` and fix any missed form.

- [ ] **Step 1: Grep**

```bash
rg "PAESI_UE|CATEGORIE|Paese UE" src/app src/components src/lib --glob '!**/mock-data.ts' --glob '!**/*.test.ts'
```

Expected remaining: seed comments in `src/types/index.ts`, mock-data, tests. Nothing in forms.

- [ ] **Step 2: README**

Document: countries/categories in Impostazioni; US is extra-EU; home country; month table columns + detail dialog; delete unsold / archive sold. Remove “there is no delete” if present.

- [ ] **Step 3: Final verification**

```bash
npx vitest run
npx tsc --noEmit
npx eslint
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: countries, categories, month detail, and archive"
```

---

## Manual verification (after migrations are applied)

1. Impostazioni → add `US` is already seeded; add `CH` / Svizzera (`ue` off). Set home IT.
2. Articoli → record a sale Estero → Stati Uniti. Vendite UE shows the US row and Extra UE; Totale UE does not include it.
3. Impostazioni → add a category, rename it, confirm catalog cards update. Delete blocked while a product uses it.
4. Dashboard → monthly table shows costo/fee/spedizione. Open Dettaglio: items sum to the row. With `?da=` mid-month, list matches the clipped totals.
5. Delete an `acquistato` row (two-step). Archive a sold row: disappears from default Articoli, KPIs unchanged, visible under Archivio, Ripristina works. Sold row has no Elimina.

---

## Out of scope (do not implement)

- i18n / renaming stored `Italia`/`Estero`
- Editing purchase fields
- Deleting `prodotti`
- Granting `ricalcola_prezzi_medi` to authenticated
- Auto-creating countries from CSV
