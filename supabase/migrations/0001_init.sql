-- Schema iniziale: catalogo prodotti, articoli (esemplari acquistati/venduti),
-- impostazioni chiave/valore e vista di aggregazione mensile delle vendite.
--
-- Le policy RLS definite qui concedono accesso a qualsiasi utente autenticato:
-- vengono sostituite da 0002_auth_allowlist.sql con policy che verificano
-- l'email contro l'allowlist. Applicare le migration in ordine.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- prodotti: anagrafica dei modelli (es. "PS5 Slim", "FIFA 24")
-- ---------------------------------------------------------------------------
create table if not exists prodotti (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  nome text not null,
  categoria text,
  piattaforma_gioco text,
  prezzo_medio_acquisto numeric check (prezzo_medio_acquisto is null or prezzo_medio_acquisto >= 0),
  prezzo_medio_vendita numeric check (prezzo_medio_vendita is null or prezzo_medio_vendita >= 0),
  note text,
  foto_url text,
  created_at timestamptz not null default now()
);

comment on table prodotti is 'Anagrafica dei modelli di prodotto (console, videogiochi, controller, accessori).';

-- ---------------------------------------------------------------------------
-- articoli: singolo esemplare fisico acquistato/rivenduto
-- ---------------------------------------------------------------------------
create table if not exists articoli (
  id uuid primary key default gen_random_uuid(),
  -- NOT NULL + ON DELETE RESTRICT: un articolo deve sempre riferire un prodotto
  -- valido; non si elimina un prodotto se esistono articoli storici collegati.
  prodotto_id uuid not null references prodotti (id) on delete restrict,

  -- Dati di acquisto: sempre presenti, un articolo esiste solo se acquistato.
  data_acquisto date not null,
  costo_acquisto numeric not null check (costo_acquisto >= 0),
  fonte_acquisto text not null,
  stato text not null default 'acquistato'
    check (stato in ('acquistato', 'in vendita', 'venduto', 'consegnato')),

  -- Dati di vendita: nullable, valorizzati solo quando l'articolo viene venduto.
  data_vendita date,
  prezzo_vendita numeric check (prezzo_vendita is null or prezzo_vendita >= 0),
  piattaforma_vendita text,
  fee numeric check (fee is null or fee >= 0),
  prodotto_sponsorizzato boolean not null default false,
  vendita_post_offerta boolean not null default false,
  destinazione text,
  spedizioniere text,
  costo_spedizione numeric check (costo_spedizione is null or costo_spedizione >= 0),

  -- Il profitto è NULL finché l'articolo non risulta venduto/consegnato:
  -- un articolo invenduto non deve apparire "in perdita".
  profitto numeric generated always as (
    case
      when stato in ('venduto', 'consegnato') and prezzo_vendita is not null
        then prezzo_vendita - costo_acquisto - coalesce(costo_spedizione, 0) - coalesce(fee, 0)
      else null
    end
  ) stored,

  created_at timestamptz not null default now(),

  constraint articoli_venduto_richiede_dati_vendita check (
    stato not in ('venduto', 'consegnato')
    or (data_vendita is not null and prezzo_vendita is not null)
  )
);

comment on table articoli is 'Ogni esemplare fisico acquistato e (eventualmente) rivenduto.';

create index if not exists idx_articoli_prodotto_id on articoli (prodotto_id);
create index if not exists idx_articoli_stato on articoli (stato);
create index if not exists idx_articoli_data_vendita on articoli (data_vendita);

-- ---------------------------------------------------------------------------
-- impostazioni: coppie chiave/valore per preferenze e configurazioni
-- ---------------------------------------------------------------------------
create table if not exists impostazioni (
  id uuid primary key default gen_random_uuid(),
  chiave text not null unique,
  valore jsonb,
  created_at timestamptz not null default now()
);

comment on table impostazioni is 'Preferenze e configurazioni applicative in formato chiave/valore.';

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- App single-user: non esiste una colonna user_id per-riga, quindi le policy
-- concedono accesso a QUALSIASI utente autenticato (non filtrano per
-- proprietario della riga). Il ruolo anon non ha alcun accesso.
--
-- Per evolvere a multi-tenant in futuro:
--   1. aggiungere `user_id uuid not null default auth.uid()` a ciascuna tabella;
--   2. sostituire `(select auth.uid()) is not null` con `user_id = (select auth.uid())`
--      nelle policy sottostanti (sia in USING che in WITH CHECK).
-- ---------------------------------------------------------------------------

alter table prodotti enable row level security;
alter table articoli enable row level security;
alter table impostazioni enable row level security;

revoke all on prodotti from anon;
revoke all on articoli from anon;
revoke all on impostazioni from anon;

grant select, insert, update, delete on prodotti to authenticated;
grant select, insert, update, delete on articoli to authenticated;
grant select, insert, update, delete on impostazioni to authenticated;

-- prodotti
drop policy if exists prodotti_select_authenticated on prodotti;
create policy prodotti_select_authenticated on prodotti
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists prodotti_insert_authenticated on prodotti;
create policy prodotti_insert_authenticated on prodotti
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists prodotti_update_authenticated on prodotti;
create policy prodotti_update_authenticated on prodotti
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists prodotti_delete_authenticated on prodotti;
create policy prodotti_delete_authenticated on prodotti
  for delete to authenticated
  using ((select auth.uid()) is not null);

-- articoli
drop policy if exists articoli_select_authenticated on articoli;
create policy articoli_select_authenticated on articoli
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists articoli_insert_authenticated on articoli;
create policy articoli_insert_authenticated on articoli
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists articoli_update_authenticated on articoli;
create policy articoli_update_authenticated on articoli
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists articoli_delete_authenticated on articoli;
create policy articoli_delete_authenticated on articoli
  for delete to authenticated
  using ((select auth.uid()) is not null);

-- impostazioni
drop policy if exists impostazioni_select_authenticated on impostazioni;
create policy impostazioni_select_authenticated on impostazioni
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists impostazioni_insert_authenticated on impostazioni;
create policy impostazioni_insert_authenticated on impostazioni
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists impostazioni_update_authenticated on impostazioni;
create policy impostazioni_update_authenticated on impostazioni
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists impostazioni_delete_authenticated on impostazioni;
create policy impostazioni_delete_authenticated on impostazioni
  for delete to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- v_vendite_mensili: aggregazione mensile degli articoli venduti/consegnati
-- security_invoker = true: la view applica le RLS del chiamante invece che
-- quelle del proprietario della view.
-- ---------------------------------------------------------------------------
create or replace view v_vendite_mensili
  with (security_invoker = true) as
select
  date_trunc('month', data_vendita)::date as mese,
  count(*) as numero_vendite,
  coalesce(avg(prezzo_vendita), 0) as prezzo_medio_vendita,
  coalesce(sum(prezzo_vendita), 0) as totale_vendite,
  coalesce(sum(profitto), 0) as profitto_totale
from articoli
where stato in ('venduto', 'consegnato')
  and data_vendita is not null
group by date_trunc('month', data_vendita)
order by mese;

comment on view v_vendite_mensili is 'Vendite aggregate per mese: conteggio, prezzo medio, totale, profitto.';

grant select on v_vendite_mensili to authenticated;
revoke all on v_vendite_mensili from anon;
