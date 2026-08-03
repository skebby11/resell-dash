-- Viste di aggregazione per la dashboard.
--
-- Motivo per cui non si aggrega più in JavaScript: PostgREST limita a 1000 le
-- righe restituite da una select senza range (`db-max-rows`), senza segnalare
-- nulla. Leggere "tutti gli articoli" per sommarli lato applicazione produceva
-- quindi KPI silenziosamente sbagliati appena superate le mille righe — vendite
-- e profitti sottostimati, senza alcun errore visibile.
--
-- Aggregare in SQL elimina il problema alla radice e rende il costo della
-- dashboard indipendente dal numero di articoli.
--
-- `security_invoker = true` su tutte: la vista applica le RLS del chiamante e
-- non quelle del proprietario. Senza questa opzione una vista scavalca le
-- policy delle tabelle sottostanti.

-- ---------------------------------------------------------------------------
-- v_kpi: riga singola con le sei metriche di testata.
-- ---------------------------------------------------------------------------
create or replace view v_kpi
  with (security_invoker = true) as
with venduti as (
  select prezzo_vendita, profitto
  from articoli
  where stato in ('venduto', 'consegnato')
),
invenduti as (
  select costo_acquisto
  from articoli
  where stato not in ('venduto', 'consegnato')
),
totali as (
  select
    (select count(*) from venduti) as numero_vendite,
    -- avg() ignora già i NULL: un articolo venduto senza prezzo registrato non
    -- abbassa la media, mentre trattarlo come zero la falserebbe.
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
  -- "Capitale" non è un saldo di cassa: è il valore a costo dello stock
  -- invenduto più l'utile già realizzato.
  round(fondi_immobilizzati + profitto_totale, 2) as capitale
from totali;

comment on view v_kpi is 'Metriche di testata della dashboard: vendite, ricavi, profitto, capitale.';

-- ---------------------------------------------------------------------------
-- Distribuzioni: conteggio delle vendite per dimensione.
--
-- Le righe con dimensione NULL sono escluse: rappresentano un dato non
-- registrato, non una categoria a sé, e comparirebbero come fetta senza nome.
-- ---------------------------------------------------------------------------
create or replace view v_distribuzione_categoria
  with (security_invoker = true) as
select p.categoria as label, count(*) as value
from articoli a
join prodotti p on p.id = a.prodotto_id
where a.stato in ('venduto', 'consegnato') and p.categoria is not null
group by p.categoria
order by count(*) desc;

create or replace view v_distribuzione_piattaforma
  with (security_invoker = true) as
select piattaforma_vendita as label, count(*) as value
from articoli
where stato in ('venduto', 'consegnato') and piattaforma_vendita is not null
group by piattaforma_vendita
order by count(*) desc;

create or replace view v_distribuzione_fonte
  with (security_invoker = true) as
select fonte_acquisto as label, count(*) as value
from articoli
where stato in ('venduto', 'consegnato') and fonte_acquisto is not null
group by fonte_acquisto
order by count(*) desc;

create or replace view v_distribuzione_destinazione
  with (security_invoker = true) as
select destinazione as label, count(*) as value
from articoli
where stato in ('venduto', 'consegnato') and destinazione is not null
group by destinazione
order by count(*) desc;

comment on view v_distribuzione_categoria is 'Vendite per categoria di prodotto.';
comment on view v_distribuzione_piattaforma is 'Vendite per piattaforma di vendita.';
comment on view v_distribuzione_fonte is 'Vendite per fonte di acquisto.';
comment on view v_distribuzione_destinazione is 'Vendite per destinazione.';

grant select on v_kpi to authenticated;
grant select on v_distribuzione_categoria to authenticated;
grant select on v_distribuzione_piattaforma to authenticated;
grant select on v_distribuzione_fonte to authenticated;
grant select on v_distribuzione_destinazione to authenticated;

revoke all on v_kpi from anon;
revoke all on v_distribuzione_categoria from anon;
revoke all on v_distribuzione_piattaforma from anon;
revoke all on v_distribuzione_fonte from anon;
revoke all on v_distribuzione_destinazione from anon;

-- Indici a supporto delle aggregazioni e della paginazione ordinata.
-- `stato` era già indicizzato; questo copre l'ordinamento della lista articoli.
create index if not exists idx_articoli_data_acquisto on articoli (data_acquisto desc, id);
