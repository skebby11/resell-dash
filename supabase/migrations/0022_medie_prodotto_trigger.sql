-- Le medie del prodotto (prezzo_medio_acquisto / prezzo_medio_vendita) si
-- riallineano da sole a ogni scrittura su `articoli`: inserimento, modifica
-- (vendita, cambio stato, correzione del costo) ed eliminazione.
--
-- Prima lo facevano solo elimina_articolo_con_ricalcolo, l'import e
-- aggiorna_costo_acquisto: inserimenti e vendite lasciavano la media vecchia,
-- e due scritture concorrenti sullo stesso prodotto potevano sovrascriversi.
-- Qui ogni scrittura passa dallo stesso percorso, che blocca le righe prodotto
-- coinvolte prima di ricalcolare (la lettura successiva vede così anche le
-- scritture concorrenti già committate).
--
-- Trigger a livello di istruzione con tabelle di transizione: un import in
-- blocco ricalcola ogni prodotto una volta, non una volta per riga.

create or replace function ricalcola_medie_prodotti(prodotto_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if prodotto_ids is null or cardinality(prodotto_ids) = 0 then
    return;
  end if;

  -- Ordine fisso sui lock: due istruzioni su insiemi di prodotti che si
  -- sovrappongono non possono andare in deadlock.
  perform 1 from public.prodotti
  where id = any(prodotto_ids)
  order by id
  for update;

  -- Sottoquery per prodotto (non join su gruppi): un prodotto rimasto senza
  -- articoli torna a NULL invece di tenere la vecchia media.
  update public.prodotti p
  set prezzo_medio_acquisto = (
        select round(avg(a.costo_acquisto)::numeric, 2)
        from public.articoli a
        where a.prodotto_id = p.id
      ),
      prezzo_medio_vendita = (
        select round(
          avg(a.prezzo_vendita) filter (
            where a.stato in ('venduto', 'consegnato') and a.prezzo_vendita is not null
          )::numeric,
          2
        )
        from public.articoli a
        where a.prodotto_id = p.id
      )
  where p.id = any(prodotto_ids);
end;
$$;

comment on function ricalcola_medie_prodotti(uuid[]) is
  'Blocca i prodotti indicati e ne ricalcola le medie di acquisto e vendita dagli articoli. Usata dai trigger su articoli.';

revoke all on function ricalcola_medie_prodotti(uuid[]) from public, anon;
grant execute on function ricalcola_medie_prodotti(uuid[]) to authenticated, service_role;

create or replace function trg_articoli_medie_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.ricalcola_medie_prodotti(
    (select array_agg(distinct prodotto_id) from new_rows)
  );
  return null;
end;
$$;

create or replace function trg_articoli_medie_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Anche il vecchio prodotto: un articolo può cambiare `prodotto_id`.
  perform public.ricalcola_medie_prodotti(
    (select array_agg(distinct id) from (
      select prodotto_id as id from old_rows
      union
      select prodotto_id as id from new_rows
    ) t)
  );
  return null;
end;
$$;

create or replace function trg_articoli_medie_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.ricalcola_medie_prodotti(
    (select array_agg(distinct prodotto_id) from old_rows)
  );
  return null;
end;
$$;

drop trigger if exists articoli_medie_insert on articoli;
create trigger articoli_medie_insert
  after insert on articoli
  referencing new table as new_rows
  for each statement execute function trg_articoli_medie_insert();

drop trigger if exists articoli_medie_update on articoli;
create trigger articoli_medie_update
  after update on articoli
  referencing old table as old_rows new table as new_rows
  for each statement execute function trg_articoli_medie_update();

drop trigger if exists articoli_medie_delete on articoli;
create trigger articoli_medie_delete
  after delete on articoli
  referencing old table as old_rows
  for each statement execute function trg_articoli_medie_delete();

-- Ora il ricalcolo lo fa il trigger: la funzione di 0020 si riduce
-- all'aggiornamento del costo, tenendo il lock sul prodotto per serializzare.
create or replace function aggiorna_costo_acquisto(articolo_id uuid, nuovo_costo numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nuovo_costo is null or nuovo_costo < 0 then
    raise exception 'Costo non valido.';
  end if;

  update public.articoli set costo_acquisto = nuovo_costo where id = articolo_id;

  if not found then
    raise exception 'Articolo non trovato.';
  end if;
end;
$$;

-- Riallinea una volta le medie già esistenti: finora inserimenti e vendite non
-- le aggiornavano.
select public.ricalcola_medie_prodotti(array(select id from public.prodotti));
