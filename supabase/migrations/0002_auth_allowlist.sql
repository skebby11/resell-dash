-- Allowlist di accesso: l'app è single-user (nessuna colonna user_id per riga),
-- ma l'ingresso è ristretto a un elenco chiuso di indirizzi email.
--
-- Difesa a più livelli:
--   1. app: la server action di login rifiuta email fuori allowlist e usa
--      `shouldCreateUser: false`, quindi non crea mai nuovi utenti;
--   2. progetto: la registrazione pubblica va disattivata da Dashboard
--      (Authentication > Sign In / Providers > Email > "Allow new users to sign up");
--   3. database: le policy RLS sottostanti verificano la claim `email` del JWT
--      contro questa tabella. Anche se un utente venisse creato per altre vie
--      (Dashboard, Admin API), senza una riga qui non legge né scrive nulla.

create table if not exists utenti_autorizzati (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  -- Le email in auth.users sono normalizzate lowercase da GoTrue: imponiamo
  -- lo stesso invariante qui, altrimenti il confronto con la claim JWT fallisce.
  constraint utenti_autorizzati_email_lowercase check (email = lower(email))
);

comment on table utenti_autorizzati is 'Elenco chiuso delle email autorizzate ad accedere all''app.';

alter table utenti_autorizzati enable row level security;

revoke all on utenti_autorizzati from anon;
revoke all on utenti_autorizzati from authenticated;
-- Solo lettura, e solo della propria riga: l'allowlist si modifica con la
-- service role key o dalla Dashboard, mai dall'app.
grant select on utenti_autorizzati to authenticated;

drop policy if exists utenti_autorizzati_select_propria_riga on utenti_autorizzati;
create policy utenti_autorizzati_select_propria_riga on utenti_autorizzati
  for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')));

-- ---------------------------------------------------------------------------
-- utente_autorizzato(): true se la claim `email` del chiamante è in allowlist.
--
-- SECURITY INVOKER (default) di proposito: la funzione legge
-- utenti_autorizzati sotto le RLS del chiamante, che vede solo la propria
-- riga. Nessun privilegio elevato, nessuna fuga dell'elenco completo.
--
-- `email` è una claim gestita da GoTrue (non da raw_user_meta_data, che è
-- modificabile dall'utente) quindi è affidabile per l'autorizzazione.
-- ---------------------------------------------------------------------------
create or replace function utente_autorizzato()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.utenti_autorizzati u
    where u.email = lower((select auth.jwt() ->> 'email'))
  );
$$;

comment on function utente_autorizzato() is 'True se la claim email del JWT corrente è presente in utenti_autorizzati.';

-- ---------------------------------------------------------------------------
-- Policy: sostituiscono il precedente `auth.uid() is not null`, che concedeva
-- accesso a QUALSIASI utente autenticato.
--
-- `(select utente_autorizzato())` invece della chiamata diretta: il subquery
-- viene valutato una volta come InitPlan anziché per ogni riga.
-- ---------------------------------------------------------------------------

-- prodotti
drop policy if exists prodotti_select_authenticated on prodotti;
create policy prodotti_select_autorizzati on prodotti
  for select to authenticated
  using ((select utente_autorizzato()));

drop policy if exists prodotti_insert_authenticated on prodotti;
create policy prodotti_insert_autorizzati on prodotti
  for insert to authenticated
  with check ((select utente_autorizzato()));

drop policy if exists prodotti_update_authenticated on prodotti;
create policy prodotti_update_autorizzati on prodotti
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

drop policy if exists prodotti_delete_authenticated on prodotti;
create policy prodotti_delete_autorizzati on prodotti
  for delete to authenticated
  using ((select utente_autorizzato()));

-- articoli
drop policy if exists articoli_select_authenticated on articoli;
create policy articoli_select_autorizzati on articoli
  for select to authenticated
  using ((select utente_autorizzato()));

drop policy if exists articoli_insert_authenticated on articoli;
create policy articoli_insert_autorizzati on articoli
  for insert to authenticated
  with check ((select utente_autorizzato()));

drop policy if exists articoli_update_authenticated on articoli;
create policy articoli_update_autorizzati on articoli
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

drop policy if exists articoli_delete_authenticated on articoli;
create policy articoli_delete_autorizzati on articoli
  for delete to authenticated
  using ((select utente_autorizzato()));

-- impostazioni
drop policy if exists impostazioni_select_authenticated on impostazioni;
create policy impostazioni_select_autorizzati on impostazioni
  for select to authenticated
  using ((select utente_autorizzato()));

drop policy if exists impostazioni_insert_authenticated on impostazioni;
create policy impostazioni_insert_autorizzati on impostazioni
  for insert to authenticated
  with check ((select utente_autorizzato()));

drop policy if exists impostazioni_update_authenticated on impostazioni;
create policy impostazioni_update_autorizzati on impostazioni
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

drop policy if exists impostazioni_delete_authenticated on impostazioni;
create policy impostazioni_delete_autorizzati on impostazioni
  for delete to authenticated
  using ((select utente_autorizzato()));

-- ---------------------------------------------------------------------------
-- Popolamento iniziale dell'allowlist.
-- ---------------------------------------------------------------------------
insert into utenti_autorizzati (email, note) values
  ('diecimeno@libero.it', 'Utente principale'),
  ('skebby11@gmail.com', 'Account di debug')
on conflict (email) do nothing;
