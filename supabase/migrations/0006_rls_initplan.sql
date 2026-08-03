-- Corregge la valutazione per-riga della claim email nelle policy.
--
-- La forma precedente era `email = lower((select auth.jwt() ->> 'email'))`: il
-- subquery era annidato dentro `lower()`, quindi l'espressione nel suo insieme
-- non veniva promossa a InitPlan e `lower()` finiva rivalutata per ogni riga.
--
-- Racchiudendo l'intera espressione — `(select lower(auth.jwt() ->> 'email'))` —
-- Postgres la calcola una volta sola per query. Segnalato dal linter Supabase
-- come `auth_rls_initplan`.
--
-- Nota per chi legge il linter: dopo questa migration `auth_rls_initplan`
-- continua a segnalare questa policy, ma è un falso positivo. Il controllo cerca
-- il pattern letterale `(select auth.<funzione>())`, mentre qui la chiamata è
-- annidata dentro `lower()`. Il piano di esecuzione conferma che l'ottimizzazione
-- c'è:
--
--   Index Scan using utenti_autorizzati_pkey on utenti_autorizzati
--     Index Cond: (email = (InitPlan 1).col1)
--     InitPlan 1
--       ->  Result (actual rows=1 loops=1)
--
-- `loops=1` sull'InitPlan: valutato una volta, non per riga. Non "correggere"
-- riportando la chiamata fuori dal subquery.

drop policy if exists utenti_autorizzati_select_propria_riga on utenti_autorizzati;
create policy utenti_autorizzati_select_propria_riga on utenti_autorizzati
  for select to authenticated
  using (email = (select lower(auth.jwt() ->> 'email')));

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
    where u.email = (select lower(auth.jwt() ->> 'email'))
  );
$$;
