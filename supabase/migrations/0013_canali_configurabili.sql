-- Canali configurabili: piattaforme di vendita, fonti di acquisto e
-- spedizionieri smettono di essere costanti cablate in src/types/index.ts e
-- diventano dati per-installazione, gestibili da Impostazioni.
--
-- Una tabella con colonna `tipo` invece di tre tabelle gemelle: le tre
-- entità hanno identica forma (nome, attivo, ordine) e identiche RLS; tre
-- tabelle triplicherebbero policy e indici senza aggiungere nulla, e
-- aggiungere un quarto tipo in futuro sarebbe un valore di dati, non uno
-- schema change. Stessa scelta già fatta per `articoli.stato` (text + CHECK,
-- non un enum Postgres).
--
-- Le colonne `articoli.piattaforma_vendita/fonte_acquisto/spedizioniere`
-- restano testo libero e non referenziano questa tabella: sono storico, e un
-- valore storico deve restare leggibile anche se il canale che lo generò
-- viene disattivato o rinominato (vedi sotto).

create table if not exists canali (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('piattaforma_vendita', 'fonte_acquisto', 'spedizioniere')),
  nome text not null check (length(trim(nome)) > 0 and length(nome) <= 60),
  -- Disattivazione, non cancellazione: righe storiche in `articoli` contengono
  -- già queste stringhe come testo libero. Cancellare la riga romperebbe la
  -- possibilità di distinguere "mai esistito" da "non più proposto nei nuovi
  -- inserimenti", e imporrebbe di riscrivere lo storico per non perdere
  -- l'informazione. Un flag lascia lo storico intatto e semplicemente esclude
  -- il canale dai suggerimenti futuri.
  attivo boolean not null default true,
  -- Ordine dei suggerimenti nel datalist: il canale più usato conviene
  -- averlo primo. Non ricalcolato automaticamente dal conteggio storico
  -- (cambierebbe l'ordine da solo, in modo sorprendente): lo decide chi
  -- amministra, dall'interfaccia di riordino.
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table canali is
  'Piattaforme di vendita, fonti di acquisto e spedizionieri configurabili per-installazione. Le colonne testo di articoli non li referenziano: sono suggerimenti, non vincoli.';
comment on column canali.tipo is 'piattaforma_vendita | fonte_acquisto | spedizioniere: corrisponde 1:1 alla colonna di articoli che quel canale suggerisce.';
comment on column canali.attivo is 'false = non più proposto nei form, ma lo storico che lo usa resta invariato e leggibile nelle statistiche.';
comment on column canali.ordine is 'Posizione nei suggerimenti, crescente. Riordinabile da Impostazioni.';

-- Unicità case-insensitive: "eBay" e "ebay" per lo stesso tipo sono lo stesso
-- canale. Un indice (non un CHECK) perché il confronto coinvolge più righe.
create unique index if not exists ux_canali_tipo_nome on canali (tipo, lower(nome));

-- A supporto della lettura più frequente: canali attivi di un tipo, in ordine,
-- per popolare i datalist dei form.
create index if not exists idx_canali_tipo_attivo_ordine on canali (tipo, attivo, ordine);

alter table canali enable row level security;

revoke all on canali from anon;
grant select, insert, update, delete on canali to authenticated;

-- Stesse policy delle altre tabelle applicative (0002/0006): accesso a chi è
-- in utenti_autorizzati, non per proprietario di riga (app single-tenant).
create policy canali_select_autorizzati on canali
  for select to authenticated
  using ((select utente_autorizzato()));

create policy canali_insert_autorizzati on canali
  for insert to authenticated
  with check ((select utente_autorizzato()));

create policy canali_update_autorizzati on canali
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

create policy canali_delete_autorizzati on canali
  for delete to authenticated
  using ((select utente_autorizzato()));

-- ---------------------------------------------------------------------------
-- Seed: i valori attualmente cablati in src/types/index.ts, nello stesso
-- ordine (così un'installazione esistente vede gli stessi suggerimenti nella
-- stessa posizione). Verificati contro `select distinct` sullo storico
-- importato: nessun valore realmente presente negli articoli manca da qui.
-- ---------------------------------------------------------------------------
insert into canali (tipo, nome, ordine) values
  ('piattaforma_vendita', 'eBay', 0),
  ('piattaforma_vendita', 'Vinted', 1),
  ('piattaforma_vendita', 'Wallapop', 2),
  ('piattaforma_vendita', 'Subito', 3),
  ('piattaforma_vendita', 'Transazione Privata', 4),
  ('fonte_acquisto', 'Vinted', 0),
  ('fonte_acquisto', 'eBay', 1),
  ('fonte_acquisto', 'Subito', 2),
  ('fonte_acquisto', 'Wallapop', 3),
  ('fonte_acquisto', 'Amici/Parenti', 4),
  ('fonte_acquisto', 'Altro', 5),
  ('spedizioniere', 'BRT', 0),
  ('spedizioniere', 'Poste Italiane', 1),
  ('spedizioniere', 'InPost', 2),
  ('spedizioniere', 'UPS', 3),
  ('spedizioniere', 'DHL', 4),
  ('spedizioniere', 'Scambio a mano', 5)
on conflict (tipo, lower(nome)) do nothing;

-- ---------------------------------------------------------------------------
-- v_conteggio_canali: quanti articoli usano ciascuna stringa storica, per
-- tipo. Serve alla pagina Impostazioni per mostrare "cosa succede se disattivo
-- questo canale" e per segnalare stringhe storiche che non corrispondono (più)
-- a nessun canale configurato (rinominato, o mai censito come canale).
--
-- Aggregata in SQL come le viste di dashboard_distribuzione_*: poche righe
-- indipendentemente dal numero di articoli, niente lettura non paginata.
-- ---------------------------------------------------------------------------
create or replace view v_conteggio_canali
  with (security_invoker = true) as
select 'piattaforma_vendita' as tipo, piattaforma_vendita as nome, count(*) as conteggio
from articoli
where piattaforma_vendita is not null
group by piattaforma_vendita
union all
select 'fonte_acquisto', fonte_acquisto, count(*)
from articoli
where fonte_acquisto is not null
group by fonte_acquisto
union all
select 'spedizioniere', spedizioniere, count(*)
from articoli
where spedizioniere is not null
group by spedizioniere;

comment on view v_conteggio_canali is 'Conteggio articoli per stringa storica di piattaforma/fonte/spedizioniere, per tipo.';

grant select on v_conteggio_canali to authenticated;
revoke all on v_conteggio_canali from anon;
