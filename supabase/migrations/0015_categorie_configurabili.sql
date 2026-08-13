-- Categorie prodotto configurabili: smettono di essere costanti cablate in
-- src/types/index.ts e diventano dati per-installazione, gestibili da
-- Impostazioni.
--
-- Stessa forma di `canali` meno `tipo`: nome, attivo, ordine. Una sola
-- entità, non tre, quindi niente colonna discriminante.
--
-- `prodotti.categoria` resta testo libero e non referenzia questa tabella:
-- è storico, e un valore deve restare leggibile anche se la categoria che
-- lo generò viene disattivata. A differenza dei canali, una rinomina
-- *propaga sempre* sui prodotti (la categoria *è* il campo prodotto: lasciare
-- orfani bloccherebbe per sempre l'eliminazione).

create table if not exists categorie (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0 and length(nome) <= 60),
  -- Disattivazione, non cancellazione: i prodotti storici contengono già
  -- queste stringhe come testo libero. Un flag le esclude dai suggerimenti
  -- futuri senza toccare l'anagrafica.
  attivo boolean not null default true,
  -- Ordine dei suggerimenti nel datalist: lo decide chi amministra, non un
  -- ricalcolo automatico dal conteggio prodotti.
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table categorie is
  'Categorie prodotto configurabili per-installazione. `prodotti.categoria` non le referenzia: sono suggerimenti, non vincoli.';
comment on column categorie.attivo is 'false = non più proposta nei form di inserimento, ma i prodotti che la usano restano invariati e leggibili nelle statistiche.';
comment on column categorie.ordine is 'Posizione nei suggerimenti, crescente. Riordinabile da Impostazioni.';

-- Unicità case-insensitive: "Videogiochi" e "videogiochi" sono la stessa
-- categoria. Un indice (non un CHECK) perché il confronto coinvolge più righe.
create unique index if not exists ux_categorie_nome on categorie (lower(nome));

-- A supporto della lettura più frequente: categorie attive, in ordine, per
-- popolare il datalist del form di inserimento.
create index if not exists idx_categorie_attivo_ordine on categorie (attivo, ordine);

alter table categorie enable row level security;

revoke all on categorie from anon;
grant select, insert, update, delete on categorie to authenticated;

-- Stesse policy delle altre tabelle applicative (0002/0006): accesso a chi è
-- in utenti_autorizzati, non per proprietario di riga (app single-tenant).
create policy categorie_select_autorizzati on categorie
  for select to authenticated
  using ((select utente_autorizzato()));

create policy categorie_insert_autorizzati on categorie
  for insert to authenticated
  with check ((select utente_autorizzato()));

create policy categorie_update_autorizzati on categorie
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

create policy categorie_delete_autorizzati on categorie
  for delete to authenticated
  using ((select utente_autorizzato()));

-- ---------------------------------------------------------------------------
-- Seed: i valori attualmente cablati in src/types/index.ts, nello stesso
-- ordine (così un'installazione esistente vede gli stessi suggerimenti nella
-- stessa posizione).
-- ---------------------------------------------------------------------------
insert into categorie (nome, ordine) values
  ('Videogiochi', 0),
  ('Console', 1),
  ('Controller', 2),
  ('Accessori', 3)
on conflict (lower(nome)) do nothing;

-- ---------------------------------------------------------------------------
-- v_conteggio_categorie: quanti prodotti usano ciascuna stringa, per
-- mostrare in Impostazioni cosa succede se si elimina o disattiva una
-- categoria. Aggregata in SQL: poche righe indipendentemente dal catalogo.
-- ---------------------------------------------------------------------------
create or replace view v_conteggio_categorie
  with (security_invoker = true) as
select categoria as nome, count(*) as conteggio
from prodotti
where categoria is not null
group by categoria;

comment on view v_conteggio_categorie is 'Conteggio prodotti per stringa categoria.';

grant select on v_conteggio_categorie to authenticated;
revoke all on v_conteggio_categorie from anon;
