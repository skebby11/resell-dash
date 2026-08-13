-- Due flussi che il client eseguiva come più richieste separate (delete +
-- select + update; update + select paginato + update a blocchi) potevano
-- interlacciarsi con una richiesta concorrente e lasciare dati incoerenti:
-- una media di prodotto calcolata su righe non ancora aggiornate, o prodotti
-- rimasti sul nome di una categoria che nel frattempo è cambiato di nuovo.
-- Spostare ciascun flusso in un'unica funzione plpgsql lo rende atomico (una
-- sola transazione implicita) e permette di bloccare le righe coinvolte con
-- `FOR UPDATE`, serializzando le richieste concorrenti sullo stesso prodotto
-- o sulla stessa categoria invece di lasciarle sovrascriversi a vicenda.

create or replace function elimina_articolo_con_ricalcolo(articolo_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato text;
  v_prodotto_id uuid;
begin
  select stato, prodotto_id into v_stato, v_prodotto_id
  from public.articoli
  where id = articolo_id
  for update;

  if not found or v_stato not in ('acquistato', 'in vendita') then
    raise exception 'Articolo non trovato o non eliminabile.';
  end if;

  -- Blocca la riga prodotto per la durata della transazione: un'eliminazione
  -- concorrente su un altro articolo dello stesso prodotto aspetta qui,
  -- invece di ricalcolare la media su dati non ancora aggiornati e
  -- sovrascrivere il risultato più recente.
  perform 1 from public.prodotti where id = v_prodotto_id for update;

  delete from public.articoli where id = articolo_id;

  update public.prodotti p
  set prezzo_medio_acquisto = agg.pm_acquisto,
      prezzo_medio_vendita = agg.pm_vendita
  from (
    select
      round(avg(costo_acquisto)::numeric, 2) as pm_acquisto,
      round(
        avg(prezzo_vendita) filter (
          where stato in ('venduto', 'consegnato') and prezzo_vendita is not null
        )::numeric,
        2
      ) as pm_vendita
    from public.articoli
    where prodotto_id = v_prodotto_id
  ) agg
  where p.id = v_prodotto_id;
end;
$$;

comment on function elimina_articolo_con_ricalcolo(uuid) is
  'Elimina un articolo invenduto e ricalcola le medie del prodotto nella stessa transazione, bloccando la riga prodotto contro eliminazioni concorrenti sullo stesso prodotto.';

revoke all on function elimina_articolo_con_ricalcolo(uuid) from public, anon;
grant execute on function elimina_articolo_con_ricalcolo(uuid) to authenticated;

create or replace function rinomina_categoria_con_propagazione(categoria_id uuid, nuovo_nome text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vecchio_nome text;
begin
  -- Blocca la riga categoria: una seconda rinomina della stessa categoria
  -- aspetta qui e riparte dal nome già aggiornato dalla prima, invece di
  -- propagare in base a un `vecchio_nome` ormai superato e lasciare orfani i
  -- prodotti che la prima chiamata ha già spostato su un nome intermedio.
  select nome into v_vecchio_nome
  from public.categorie
  where id = categoria_id
  for update;

  if not found then
    raise exception 'Categoria non trovata.';
  end if;

  update public.categorie set nome = nuovo_nome where id = categoria_id;

  if lower(v_vecchio_nome) <> lower(nuovo_nome) then
    update public.prodotti
    set categoria = nuovo_nome
    where categoria is not null and lower(categoria) = lower(v_vecchio_nome);
  end if;
end;
$$;

comment on function rinomina_categoria_con_propagazione(uuid, text) is
  'Rinomina una categoria e propaga il nome ai prodotti nella stessa transazione, bloccando la riga categoria contro rinomine concorrenti della stessa categoria.';

revoke all on function rinomina_categoria_con_propagazione(uuid, text) from public, anon;
grant execute on function rinomina_categoria_con_propagazione(uuid, text) to authenticated;
