-- ricalcola_prezzi_medi(): riallinea prezzo_medio_acquisto e
-- prezzo_medio_vendita di ogni prodotto alla media effettiva dei suoi articoli.
--
-- Serve dopo un import in blocco: il foglio di origine non conteneva i prezzi
-- medi, ma sono il riferimento che si guarda in fase di acquisto ("quanto l'ho
-- pagata e rivenduta le altre volte?").
--
-- SECURITY INVOKER (default) di proposito: la funzione non deve concedere
-- privilegi che il chiamante non ha già. Inoltre l'EXECUTE viene revocato ai
-- ruoli pubblici — Postgres lo concede a PUBLIC per default su ogni nuova
-- funzione — così resta un'operazione amministrativa, invocabile solo con la
-- service role key.
create or replace function ricalcola_prezzi_medi()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.prodotti p
  set prezzo_medio_acquisto = medie.medio_acquisto,
      prezzo_medio_vendita = medie.medio_vendita
  from (
    select
      a.prodotto_id,
      round(avg(a.costo_acquisto), 2) as medio_acquisto,
      -- Solo le vendite concluse: includere gli invenduti (prezzo NULL) non
      -- sposterebbe la media, ma un articolo con prezzo 0 sì, e uno stato
      -- "acquistato" con un prezzo residuo non è una vendita.
      round(avg(a.prezzo_vendita) filter (
        where a.stato in ('venduto', 'consegnato') and a.prezzo_vendita is not null
      ), 2) as medio_vendita
    from public.articoli a
    group by a.prodotto_id
  ) as medie
  where medie.prodotto_id = p.id;
$$;

comment on function ricalcola_prezzi_medi() is
  'Riallinea i prezzi medi dei prodotti alla media effettiva dei relativi articoli. Operazione amministrativa.';

revoke all on function ricalcola_prezzi_medi() from public;
revoke all on function ricalcola_prezzi_medi() from anon;
revoke all on function ricalcola_prezzi_medi() from authenticated;
grant execute on function ricalcola_prezzi_medi() to service_role;
