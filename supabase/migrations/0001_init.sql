-- Schema iniziale: catalogo prodotti, articoli (esemplari acquistati/venduti),
-- impostazioni chiave/valore e vista di aggregazione mensile delle vendite.
-- Nota: questo file non viene applicato automaticamente; serve solo da riferimento
-- per il futuro collegamento a un progetto Supabase.

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
  prezzo_medio_acquisto numeric,
  prezzo_medio_vendita numeric,
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
  prodotto_id uuid references prodotti (id) on delete set null,

  data_acquisto date,
  costo_acquisto numeric,
  fonte_acquisto text,
  stato text not null default 'acquistato'
    check (stato in ('acquistato', 'in vendita', 'venduto', 'consegnato')),

  data_vendita date,
  prezzo_vendita numeric,
  piattaforma_vendita text,
  fee numeric,
  prodotto_sponsorizzato boolean not null default false,
  vendita_post_offerta boolean not null default false,
  destinazione text,
  spedizioniere text,
  costo_spedizione numeric,

  profitto numeric generated always as (
    coalesce(prezzo_vendita, 0) - coalesce(costo_acquisto, 0)
    - coalesce(costo_spedizione, 0) - coalesce(fee, 0)
  ) stored,

  created_at timestamptz not null default now()
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
-- v_vendite_mensili: aggregazione mensile degli articoli venduti/consegnati
-- ---------------------------------------------------------------------------
create or replace view v_vendite_mensili as
select
  date_trunc('month', data_vendita)::date as mese,
  count(*) as numero_vendite,
  avg(prezzo_vendita) as prezzo_medio_vendita,
  sum(prezzo_vendita) as totale_vendite,
  sum(profitto) as profitto_totale
from articoli
where stato in ('venduto', 'consegnato')
  and data_vendita is not null
group by date_trunc('month', data_vendita)
order by mese;

comment on view v_vendite_mensili is 'Vendite aggregate per mese: conteggio, prezzo medio, totale, profitto.';
