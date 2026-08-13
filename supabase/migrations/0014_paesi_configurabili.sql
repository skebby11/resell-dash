-- Paesi configurabili: il paese di vendita smette di essere un CHECK chiuso
-- sui 27 stati UE (0009_paese_vendita) e diventa una tabella per-installazione,
-- gestibile da Impostazioni. Un'installazione open-source non è necessariamente
-- in Italia e deve poter registrare destinazioni extra-UE (a partire dagli
-- Stati Uniti) senza toccare il codice.
--
-- A differenza di `canali`, `articoli.paese_vendita` *referenzia* questa
-- tabella (FK ON DELETE RESTRICT): un codice in uso nello storico non si
-- cancella. Il codice è immutabile dopo l'insert — un codice sbagliato è
-- una riga nuova, non una riscrittura di `articoli` / `paese_origine`.
--
-- `destinazione` resta 'Italia'/'Estero' (significano paese di origine /
-- estero, non letteralmente l'Italia). La coerenza col paese di origine
-- (`impostazioni.paese_origine`) non è un CHECK: un CHECK che legge
-- `impostazioni` romperebbe le righe storiche al cambio di origine. Quella
-- invariante la impone la validazione in scrittura.

create table if not exists paesi (
  codice text primary key check (codice ~ '^[A-Z]{2}$'),
  nome text not null check (length(trim(nome)) > 0 and length(nome) <= 60),
  -- Membro del set UE-27 usato da Vendite UE. Non inferito dal codice: lo
  -- decide chi amministra (US è extra-UE, un nuovo membro va marcato a mano).
  ue boolean not null default false,
  -- Disattivazione, non cancellazione: le righe storiche in `articoli`
  -- tengono il codice. Cancellare la riga è bloccato dalla FK se è in uso,
  -- e comunque imporrebbe di riscrivere lo storico. Un flag lascia lo
  -- storico intatto e semplicemente esclude il paese dai selettori futuri.
  attivo boolean not null default true,
  -- Ordine nei selettori: il paese più usato conviene averlo primo. Non
  -- ricalcolato automaticamente dal conteggio storico (cambierebbe l'ordine
  -- da solo, in modo sorprendente): lo decide chi amministra.
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table paesi is
  'Paesi di vendita configurabili per-installazione. `articoli.paese_vendita` li referenzia (FK ON DELETE RESTRICT): un codice in uso nello storico non si cancella.';
comment on column paesi.codice is 'ISO 3166-1 alpha-2, maiuscolo. Immutabile dopo l''insert: un codice sbagliato è una riga nuova, non una riscrittura dello storico.';
comment on column paesi.nome is 'Nome visualizzato (1-60 caratteri). Unico case-insensitive.';
comment on column paesi.ue is 'true = membro UE-27 per il totale di Vendite UE. Non inferito dal codice: lo decide chi amministra.';
comment on column paesi.attivo is 'false = non più proposto nei form di vendita, ma lo storico che lo usa resta invariato e leggibile nelle statistiche.';
comment on column paesi.ordine is 'Posizione nei selettori, crescente. Riordinabile da Impostazioni.';

-- Unicità case-insensitive: "Francia" e "francia" sono lo stesso paese.
-- Un indice (non un CHECK) perché il confronto coinvolge più righe.
create unique index if not exists ux_paesi_nome on paesi (lower(nome));

-- A supporto della lettura più frequente: paesi attivi, in ordine, per
-- popolare i selettori dei form di vendita.
create index if not exists idx_paesi_attivo_ordine on paesi (attivo, ordine);

alter table paesi enable row level security;

revoke all on paesi from anon;
grant select, insert, update, delete on paesi to authenticated;

-- Stesse policy delle altre tabelle applicative (0002/0006): accesso a chi è
-- in utenti_autorizzati, non per proprietario di riga (app single-tenant).
create policy paesi_select_autorizzati on paesi
  for select to authenticated
  using ((select utente_autorizzato()));

create policy paesi_insert_autorizzati on paesi
  for insert to authenticated
  with check ((select utente_autorizzato()));

create policy paesi_update_autorizzati on paesi
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

create policy paesi_delete_autorizzati on paesi
  for delete to authenticated
  using ((select utente_autorizzato()));

-- ---------------------------------------------------------------------------
-- Seed: i 27 stati membri UE già cablati in src/types/index.ts (PAESI_UE),
-- nello stesso ordine, più gli Stati Uniti. Un'installazione esistente vede
-- gli stessi paesi UE di prima, più US come destinazione extra-UE.
-- ---------------------------------------------------------------------------
insert into paesi (codice, nome, ue, attivo, ordine) values
  ('AT', 'Austria', true, true, 0),
  ('BE', 'Belgio', true, true, 1),
  ('BG', 'Bulgaria', true, true, 2),
  ('CY', 'Cipro', true, true, 3),
  ('HR', 'Croazia', true, true, 4),
  ('DK', 'Danimarca', true, true, 5),
  ('EE', 'Estonia', true, true, 6),
  ('FI', 'Finlandia', true, true, 7),
  ('FR', 'Francia', true, true, 8),
  ('DE', 'Germania', true, true, 9),
  ('GR', 'Grecia', true, true, 10),
  ('IE', 'Irlanda', true, true, 11),
  ('IT', 'Italia', true, true, 12),
  ('LV', 'Lettonia', true, true, 13),
  ('LT', 'Lituania', true, true, 14),
  ('LU', 'Lussemburgo', true, true, 15),
  ('MT', 'Malta', true, true, 16),
  ('NL', 'Paesi Bassi', true, true, 17),
  ('PL', 'Polonia', true, true, 18),
  ('PT', 'Portogallo', true, true, 19),
  ('CZ', 'Repubblica Ceca', true, true, 20),
  ('RO', 'Romania', true, true, 21),
  ('SK', 'Slovacchia', true, true, 22),
  ('SI', 'Slovenia', true, true, 23),
  ('ES', 'Spagna', true, true, 24),
  ('SE', 'Svezia', true, true, 25),
  ('HU', 'Ungheria', true, true, 26),
  ('US', 'Stati Uniti', false, true, 27)
on conflict (codice) do nothing;

-- Paese di origine dell'installazione (default Italia). `destinazione =
-- 'Italia'` in scrittura si traduce in questo codice. Non riscrive lo
-- storico se qualcuno lo cambia in seguito.
insert into impostazioni (chiave, valore)
values ('paese_origine', '"IT"'::jsonb)
on conflict (chiave) do nothing;

-- Il CHECK chiuso sui 27 codici UE lascia il posto alla FK su `paesi`.
alter table articoli drop constraint if exists articoli_paese_vendita_valido;

-- La coerenza destinazione/paese non nomina più 'IT': 'Italia'/'Estero'
-- significano origine/estero, e l'origine è configurabile. Paese noto
-- implica solo che destinazione sia uno dei due valori ammessi.
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

comment on column articoli.paese_vendita is
  'Codice ISO 3166-1 alpha-2 del paese di vendita, tra i valori in `paesi`. NULL = paese non noto (storico, o vendita estera non ancora censita).';

-- ---------------------------------------------------------------------------
-- v_conteggio_paesi: quanti articoli usano ciascun codice, per mostrare
-- in Impostazioni "cosa succede se cancello questo paese" (cancellazione
-- già bloccata dalla FK se il conteggio è > 0).
--
-- Aggregata in SQL come v_conteggio_canali: poche righe indipendentemente
-- dal numero di articoli, niente lettura non paginata.
-- ---------------------------------------------------------------------------
create or replace view v_conteggio_paesi
  with (security_invoker = true) as
select paese_vendita as codice, count(*)::int as conteggio
from articoli
where paese_vendita is not null
group by paese_vendita;

comment on view v_conteggio_paesi is 'Conteggio articoli per codice paese di vendita.';

grant select on v_conteggio_paesi to authenticated;
revoke all on v_conteggio_paesi from anon;
