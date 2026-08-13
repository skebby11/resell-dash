-- Lo scambio di `ordine` tra due righe vicine (spostaPaese/spostaCategoria)
-- era due UPDATE separate eseguite dal client: se la seconda falliva, le due
-- righe restavano con lo stesso `ordine` (nessun vincolo di unicità lo
-- impedisce), l'ordinamento ricadeva sul tie-break per nome, e uno spostamento
-- successivo poteva saltare una riga.
--
-- Le funzioni sotto fanno lo scambio in una sola istruzione SQL: i nuovi
-- valori sono letti dalla stessa riga sorgente prima che l'UPDATE tocchi
-- qualunque riga, quindi l'operazione è atomica senza bisogno di una
-- transazione esplicita lato client.

create or replace function scambia_ordine_paesi(cod_a text, cod_b text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.paesi p
  set ordine = v.nuovo_ordine
  from (
    values
      (cod_a, (select ordine from public.paesi where codice = cod_b)),
      (cod_b, (select ordine from public.paesi where codice = cod_a))
  ) as v(codice, nuovo_ordine)
  where p.codice = v.codice;
$$;

comment on function scambia_ordine_paesi(text, text) is
  'Scambia ordine tra due paesi in un''unica istruzione atomica. Usata da spostaPaese al posto di due UPDATE separate.';

revoke all on function scambia_ordine_paesi(text, text) from public, anon;
grant execute on function scambia_ordine_paesi(text, text) to authenticated;

create or replace function scambia_ordine_categorie(id_a uuid, id_b uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.categorie c
  set ordine = v.nuovo_ordine
  from (
    values
      (id_a, (select ordine from public.categorie where id = id_b)),
      (id_b, (select ordine from public.categorie where id = id_a))
  ) as v(id, nuovo_ordine)
  where c.id = v.id;
$$;

comment on function scambia_ordine_categorie(uuid, uuid) is
  'Scambia ordine tra due categorie in un''unica istruzione atomica. Usata da spostaCategoria al posto di due UPDATE separate.';

revoke all on function scambia_ordine_categorie(uuid, uuid) from public, anon;
grant execute on function scambia_ordine_categorie(uuid, uuid) to authenticated;
