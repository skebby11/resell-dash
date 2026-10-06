-- Modifica del costo d'acquisto di un articolo e ricalcolo delle medie del
-- prodotto nella stessa transazione (stesso schema di
-- elimina_articolo_con_ricalcolo, 0019). `profitto` è una colonna generated:
-- si riallinea da sola.

create or replace function aggiorna_costo_acquisto(articolo_id uuid, nuovo_costo numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prodotto_id uuid;
begin
  if nuovo_costo is null or nuovo_costo < 0 then
    raise exception 'Costo non valido.';
  end if;

  select prodotto_id into v_prodotto_id
  from public.articoli
  where id = articolo_id
  for update;

  if not found then
    raise exception 'Articolo non trovato.';
  end if;

  perform 1 from public.prodotti where id = v_prodotto_id for update;

  update public.articoli set costo_acquisto = nuovo_costo where id = articolo_id;

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

comment on function aggiorna_costo_acquisto(uuid, numeric) is
  'Aggiorna il costo d''acquisto di un articolo e ricalcola le medie del prodotto nella stessa transazione.';

revoke all on function aggiorna_costo_acquisto(uuid, numeric) from public, anon;
grant execute on function aggiorna_costo_acquisto(uuid, numeric) to authenticated;
