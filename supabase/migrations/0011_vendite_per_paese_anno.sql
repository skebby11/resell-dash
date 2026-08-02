-- Totali di vendita per paese e anno solare: la tabella che serve
-- all'obbligo di legge (quanto venduto in ciascun paese UE, per anno).
--
-- A differenza delle viste dashboard, questa NON accetta parametri di periodo
-- e non deve: è per definizione uno storico per anno solare, non un dato che
-- ha senso "restringere" a un intervallo arbitrario.
--
-- `paese_vendita` NULL compare come proprio gruppo (non viene escluso): è la
-- riga che rende visibile la lacuna sulle vendite estere non ancora censite,
-- invece di nasconderla sommandola altrove o filtrandola via.
create or replace view v_vendite_per_paese_anno
  with (security_invoker = true) as
select
  extract(year from data_vendita)::int as anno,
  paese_vendita as paese,
  count(*) as numero_vendite,
  coalesce(round(sum(prezzo_vendita), 2), 0) as totale_vendite,
  coalesce(round(sum(profitto), 2), 0) as profitto_totale
from articoli
where stato in ('venduto', 'consegnato') and data_vendita is not null
group by extract(year from data_vendita), paese_vendita
order by anno, paese nulls last;

comment on view v_vendite_per_paese_anno is
  'Vendite (venduto/consegnato) per paese UE e anno solare. paese NULL = vendita senza paese noto (da correggere da /articoli).';

grant select on v_vendite_per_paese_anno to authenticated;
revoke all on v_vendite_per_paese_anno from anon;
