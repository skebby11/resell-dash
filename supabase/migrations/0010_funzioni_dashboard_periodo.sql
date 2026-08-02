-- Filtro periodo per la dashboard: KPI, andamento mensile e distribuzioni
-- ricalcolati su un intervallo di date.
--
-- Le viste non accettano parametri, quindi l'aritmetica si sposta in funzioni
-- SQL che restituiscono tabelle (`returns table`), invocabili da PostgREST via
-- `supabase.rpc()`. Le viste storiche (v_kpi, v_vendite_mensili,
-- v_distribuzione_*) diventano involucri sottili che chiamano le stesse
-- funzioni con `p_da/p_a` nulli: un'unica implementazione dell'aritmetica,
-- non due mantenute in parallelo.
--
-- `security invoker` + `set search_path = ''`: la funzione applica le RLS di
-- chi chiama (non di chi l'ha creata) e non risolve nomi non qualificati su
-- uno search_path scrivibile da altri.
--
-- I parametri `p_da`/`p_a` sono nominati per non entrare in collisione con gli
-- alias di tabella (`a` per `articoli`) usati nel corpo delle funzioni.

-- ---------------------------------------------------------------------------
-- dashboard_kpi: le sei metriche di testata, filtrate per periodo.
--
-- Punto concettuale: "fondi immobilizzati" è una fotografia dello stock non
-- ancora venduto, non una metrica di vendite. Non ha una data di vendita per
-- definizione, quindi il filtro periodo qui si applica alla data di ACQUISTO.
-- Con un periodo diverso da "tutto" il numero non significa più "capitale
-- fermo oggi" ma "capitale fermo in merce acquistata in quel periodo": la UI
-- deve renderlo esplicito, non lasciarlo intuire dal nome della card.
-- ---------------------------------------------------------------------------
create or replace function dashboard_kpi(p_da date, p_a date)
returns table (
  numero_vendite bigint,
  prezzo_medio_vendita numeric,
  vendite_totali numeric,
  profitto_totale numeric,
  fondi_immobilizzati numeric,
  capitale numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with venduti as (
    select prezzo_vendita, profitto
    from public.articoli
    where stato in ('venduto', 'consegnato')
      and (p_da is null or data_vendita >= p_da)
      and (p_a is null or data_vendita <= p_a)
  ),
  invenduti as (
    select costo_acquisto
    from public.articoli
    where stato not in ('venduto', 'consegnato')
      and (p_da is null or data_acquisto >= p_da)
      and (p_a is null or data_acquisto <= p_a)
  ),
  totali as (
    select
      (select count(*) from venduti) as numero_vendite,
      coalesce(round((select avg(prezzo_vendita) from venduti), 2), 0) as prezzo_medio_vendita,
      coalesce(round((select sum(prezzo_vendita) from venduti), 2), 0) as vendite_totali,
      coalesce(round((select sum(profitto) from venduti), 2), 0) as profitto_totale,
      coalesce(round((select sum(costo_acquisto) from invenduti), 2), 0) as fondi_immobilizzati
  )
  select
    numero_vendite,
    prezzo_medio_vendita,
    vendite_totali,
    profitto_totale,
    fondi_immobilizzati,
    round(fondi_immobilizzati + profitto_totale, 2) as capitale
  from totali;
$$;

comment on function dashboard_kpi(date, date) is
  'Metriche di testata filtrate per periodo (NULL = nessun limite). Vendite su data_vendita, stock invenduto su data_acquisto.';

-- ---------------------------------------------------------------------------
-- dashboard_vendite_mensili: andamento mensile, filtrato per periodo.
-- ---------------------------------------------------------------------------
create or replace function dashboard_vendite_mensili(p_da date, p_a date)
returns table (
  mese date,
  numero_vendite bigint,
  prezzo_medio_vendita numeric,
  totale_vendite numeric,
  profitto_totale numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc('month', data_vendita)::date as mese,
    count(*) as numero_vendite,
    coalesce(avg(prezzo_vendita), 0) as prezzo_medio_vendita,
    coalesce(sum(prezzo_vendita), 0) as totale_vendite,
    coalesce(sum(profitto), 0) as profitto_totale
  from public.articoli
  where stato in ('venduto', 'consegnato')
    and data_vendita is not null
    and (p_da is null or data_vendita >= p_da)
    and (p_a is null or data_vendita <= p_a)
  group by date_trunc('month', data_vendita)
  order by mese;
$$;

-- ---------------------------------------------------------------------------
-- Distribuzioni per dimensione, filtrate per periodo (su data_vendita).
-- ---------------------------------------------------------------------------
create or replace function dashboard_distribuzione_categoria(p_da date, p_a date)
returns table (label text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.categoria as label, count(*) as value
  from public.articoli a
  join public.prodotti p on p.id = a.prodotto_id
  where a.stato in ('venduto', 'consegnato') and p.categoria is not null
    and (p_da is null or a.data_vendita >= p_da)
    and (p_a is null or a.data_vendita <= p_a)
  group by p.categoria
  order by count(*) desc;
$$;

create or replace function dashboard_distribuzione_piattaforma(p_da date, p_a date)
returns table (label text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select piattaforma_vendita as label, count(*) as value
  from public.articoli
  where stato in ('venduto', 'consegnato') and piattaforma_vendita is not null
    and (p_da is null or data_vendita >= p_da)
    and (p_a is null or data_vendita <= p_a)
  group by piattaforma_vendita
  order by count(*) desc;
$$;

create or replace function dashboard_distribuzione_fonte(p_da date, p_a date)
returns table (label text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select fonte_acquisto as label, count(*) as value
  from public.articoli
  where stato in ('venduto', 'consegnato') and fonte_acquisto is not null
    and (p_da is null or data_vendita >= p_da)
    and (p_a is null or data_vendita <= p_a)
  group by fonte_acquisto
  order by count(*) desc;
$$;

create or replace function dashboard_distribuzione_destinazione(p_da date, p_a date)
returns table (label text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select destinazione as label, count(*) as value
  from public.articoli
  where stato in ('venduto', 'consegnato') and destinazione is not null
    and (p_da is null or data_vendita >= p_da)
    and (p_a is null or data_vendita <= p_a)
  group by destinazione
  order by count(*) desc;
$$;

-- ---------------------------------------------------------------------------
-- Le viste storiche diventano involucri sottili: stesso output di prima
-- (nessun cambiamento per chi le legge), stessa aritmetica delle funzioni.
-- ---------------------------------------------------------------------------
create or replace view v_kpi
  with (security_invoker = true) as
select * from dashboard_kpi(null, null);

create or replace view v_vendite_mensili
  with (security_invoker = true) as
select * from dashboard_vendite_mensili(null, null);

create or replace view v_distribuzione_categoria
  with (security_invoker = true) as
select * from dashboard_distribuzione_categoria(null, null);

create or replace view v_distribuzione_piattaforma
  with (security_invoker = true) as
select * from dashboard_distribuzione_piattaforma(null, null);

create or replace view v_distribuzione_fonte
  with (security_invoker = true) as
select * from dashboard_distribuzione_fonte(null, null);

create or replace view v_distribuzione_destinazione
  with (security_invoker = true) as
select * from dashboard_distribuzione_destinazione(null, null);

comment on view v_kpi is 'Metriche di testata della dashboard (tutto lo storico). Involucro di dashboard_kpi(null, null).';
comment on view v_vendite_mensili is 'Vendite aggregate per mese (tutto lo storico). Involucro di dashboard_vendite_mensili(null, null).';

grant execute on function dashboard_kpi(date, date) to authenticated;
grant execute on function dashboard_vendite_mensili(date, date) to authenticated;
grant execute on function dashboard_distribuzione_categoria(date, date) to authenticated;
grant execute on function dashboard_distribuzione_piattaforma(date, date) to authenticated;
grant execute on function dashboard_distribuzione_fonte(date, date) to authenticated;
grant execute on function dashboard_distribuzione_destinazione(date, date) to authenticated;

revoke all on function dashboard_kpi(date, date) from anon, public;
revoke all on function dashboard_vendite_mensili(date, date) from anon, public;
revoke all on function dashboard_distribuzione_categoria(date, date) from anon, public;
revoke all on function dashboard_distribuzione_piattaforma(date, date) from anon, public;
revoke all on function dashboard_distribuzione_fonte(date, date) from anon, public;
revoke all on function dashboard_distribuzione_destinazione(date, date) from anon, public;
