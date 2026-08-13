-- Dettaglio costi delle vendite mensili: oltre a conteggio, prezzo medio,
-- totale e profitto, la dashboard mostra costo merce, fee e spedizione.
--
-- `CREATE OR REPLACE FUNCTION` non può aggiungere colonne a un `RETURNS TABLE`
-- esistente: bisogna DROP della vista involucro e della funzione, poi
-- ricrearle con la signature allargata.

-- ---------------------------------------------------------------------------
-- dashboard_vendite_mensili: andamento mensile, filtrato per periodo.
-- Aggiunge costo_merci, fee_totali, spedizione_totale per il dettaglio tabella.
-- ---------------------------------------------------------------------------
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

comment on view v_vendite_mensili is
  'Vendite aggregate per mese (tutto lo storico). Involucro di dashboard_vendite_mensili(null, null). Include costo merce, fee e spedizione.';

grant execute on function dashboard_vendite_mensili(date, date) to authenticated;
revoke all on function dashboard_vendite_mensili(date, date) from anon, public;
grant select on v_vendite_mensili to authenticated;
revoke all on v_vendite_mensili from anon;
