-- Lo scambio di `ordine` tra due righe vicine (spostaPaese/spostaCategoria)
-- era due UPDATE separate eseguite dal client: se la seconda falliva, le due
-- righe restavano con lo stesso `ordine` (nessun vincolo di unicità lo
-- impedisce), l'ordinamento ricadeva sul tie-break per nome, e uno spostamento
-- successivo poteva saltare una riga.
--
-- Le funzioni sotto fanno lo scambio in un'unica funzione plpgsql, eseguita
-- per intero nella transazione implicita della chiamata RPC. Le due righe
-- sono bloccate con `FOR UPDATE` prima di leggerne `ordine`, in un ordine
-- deterministico (per codice/id crescente): senza il lock, due scambi che
-- condividono una riga (A↔B e B↔C) potrebbero leggere lo stesso valore di
-- partenza in READ COMMITTED e produrre un `ordine` duplicato; l'ordine
-- deterministico dei lock evita deadlock tra scambi concorrenti.

create or replace function scambia_ordine_paesi(cod_a text, cod_b text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ord_a integer;
  ord_b integer;
begin
  if cod_a = cod_b then
    return;
  end if;

  if cod_a < cod_b then
    select ordine into ord_a from public.paesi where codice = cod_a for update;
    select ordine into ord_b from public.paesi where codice = cod_b for update;
  else
    select ordine into ord_b from public.paesi where codice = cod_b for update;
    select ordine into ord_a from public.paesi where codice = cod_a for update;
  end if;

  if ord_a is null or ord_b is null then
    return;
  end if;

  update public.paesi set ordine = ord_b where codice = cod_a;
  update public.paesi set ordine = ord_a where codice = cod_b;
end;
$$;

comment on function scambia_ordine_paesi(text, text) is
  'Scambia ordine tra due paesi in modo atomico, con lock deterministico sulle due righe per evitare duplicati sotto scambi concorrenti sovrapposti.';

revoke all on function scambia_ordine_paesi(text, text) from public, anon;
grant execute on function scambia_ordine_paesi(text, text) to authenticated;

create or replace function scambia_ordine_categorie(id_a uuid, id_b uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ord_a integer;
  ord_b integer;
begin
  if id_a = id_b then
    return;
  end if;

  if id_a < id_b then
    select ordine into ord_a from public.categorie where id = id_a for update;
    select ordine into ord_b from public.categorie where id = id_b for update;
  else
    select ordine into ord_b from public.categorie where id = id_b for update;
    select ordine into ord_a from public.categorie where id = id_a for update;
  end if;

  if ord_a is null or ord_b is null then
    return;
  end if;

  update public.categorie set ordine = ord_b where id = id_a;
  update public.categorie set ordine = ord_a where id = id_b;
end;
$$;

comment on function scambia_ordine_categorie(uuid, uuid) is
  'Scambia ordine tra due categorie in modo atomico, con lock deterministico sulle due righe per evitare duplicati sotto scambi concorrenti sovrapposti.';

revoke all on function scambia_ordine_categorie(uuid, uuid) from public, anon;
grant execute on function scambia_ordine_categorie(uuid, uuid) to authenticated;
