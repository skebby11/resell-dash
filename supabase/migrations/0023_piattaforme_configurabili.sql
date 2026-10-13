-- Piattaforme di gioco configurabili: smettono di essere la costante cablata
-- PIATTAFORME_GIOCO in src/types/index.ts e diventano dati per-installazione,
-- gestibili da Impostazioni. Stessa forma di `categorie` (0015).
--
-- `prodotti.piattaforma_gioco` resta testo libero e non referenzia questa
-- tabella: sono suggerimenti, non vincoli. Una rinomina propaga sempre sui
-- prodotti (la piattaforma *è* il campo prodotto).

create table if not exists piattaforme (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0 and length(nome) <= 60),
  attivo boolean not null default true,
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table piattaforme is
  'Piattaforme di gioco configurabili per-installazione. `prodotti.piattaforma_gioco` non le referenzia: sono suggerimenti, non vincoli.';
comment on column piattaforme.attivo is 'false = non più proposta nei form, ma i prodotti che la usano restano invariati.';
comment on column piattaforme.ordine is 'Posizione nei suggerimenti, crescente. Riordinabile da Impostazioni.';

create unique index if not exists ux_piattaforme_nome on piattaforme (lower(nome));
create index if not exists idx_piattaforme_attivo_ordine on piattaforme (attivo, ordine);

alter table piattaforme enable row level security;

revoke all on piattaforme from anon;
grant select, insert, update, delete on piattaforme to authenticated;

create policy piattaforme_select_autorizzati on piattaforme
  for select to authenticated
  using ((select utente_autorizzato()));

create policy piattaforme_insert_autorizzati on piattaforme
  for insert to authenticated
  with check ((select utente_autorizzato()));

create policy piattaforme_update_autorizzati on piattaforme
  for update to authenticated
  using ((select utente_autorizzato()))
  with check ((select utente_autorizzato()));

create policy piattaforme_delete_autorizzati on piattaforme
  for delete to authenticated
  using ((select utente_autorizzato()));

-- ---------------------------------------------------------------------------
-- Seed: i valori già presenti sui prodotti, dal più usato al meno usato. Per
-- ogni gruppo di grafie equivalenti (maiuscole/spazi ignorati) vince la grafia
-- più usata. Varianti diverse dello stesso nome ("PS4" / "PlayStation 4")
-- restano voci separate: si uniscono da Impostazioni rinominando l'una
-- nell'altra. Su un'installazione nuova, senza prodotti, si parte dai valori
-- noti dell'app. Rieseguibile: on conflict do nothing.
-- ---------------------------------------------------------------------------
insert into piattaforme (nome, ordine)
select nome,
       (select coalesce(max(ordine), -1) from piattaforme) + row_number() over (order by n desc, nome)
from (
  select distinct on (lower(trim(piattaforma_gioco)))
         trim(piattaforma_gioco) as nome,
         sum(count(*)) over (partition by lower(trim(piattaforma_gioco))) as n
  from prodotti
  where nullif(trim(piattaforma_gioco), '') is not null
    and length(trim(piattaforma_gioco)) <= 60
  group by trim(piattaforma_gioco)
  order by lower(trim(piattaforma_gioco)), count(*) desc, trim(piattaforma_gioco)
) t
on conflict (lower(nome)) do nothing;

insert into piattaforme (nome, ordine)
select v.nome, v.ordine
from (values
  ('PS5', 0),
  ('PS4', 1),
  ('Xbox Series X|S', 2),
  ('Xbox One', 3),
  ('Nintendo Switch', 4),
  ('Nintendo Switch OLED', 5),
  ('Nintendo Switch Lite', 6),
  ('PC', 7)
) as v(nome, ordine)
where not exists (select 1 from piattaforme)
on conflict (lower(nome)) do nothing;

-- ---------------------------------------------------------------------------
-- v_conteggio_piattaforme: quanti prodotti usano ciascuna stringa.
-- ---------------------------------------------------------------------------
create or replace view v_conteggio_piattaforme
  with (security_invoker = true) as
select piattaforma_gioco as nome, count(*) as conteggio
from prodotti
where piattaforma_gioco is not null
group by piattaforma_gioco;

comment on view v_conteggio_piattaforme is 'Conteggio prodotti per stringa piattaforma.';

grant select on v_conteggio_piattaforme to authenticated;
revoke all on v_conteggio_piattaforme from anon;

-- ---------------------------------------------------------------------------
-- Rinomina con propagazione e scambio d'ordine atomici (stesso schema di
-- rinomina_categoria_con_propagazione e scambia_ordine_categorie).
-- ---------------------------------------------------------------------------
-- Rinominare una piattaforma col nome di un'altra già esistente le *unisce*:
-- i prodotti passano alla voce di destinazione (con la sua grafia) e la voce
-- rinominata sparisce. È il modo per riordinare varianti come "ps4" e
-- "PlayStation 4". Restituisce true se c'è stata un'unione.
create or replace function rinomina_piattaforma_con_propagazione(piattaforma_id uuid, nuovo_nome text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_vecchio_nome text;
  v_dest_id uuid;
  v_dest_nome text;
begin
  select nome into v_vecchio_nome
  from public.piattaforme
  where id = piattaforma_id
  for update;

  if not found then
    raise exception 'Piattaforma non trovata.';
  end if;

  select id, nome into v_dest_id, v_dest_nome
  from public.piattaforme
  where lower(nome) = lower(trim(nuovo_nome)) and id <> piattaforma_id
  for update;

  if found then
    update public.prodotti
    set piattaforma_gioco = v_dest_nome
    where piattaforma_gioco is not null
      and lower(trim(piattaforma_gioco)) = lower(v_vecchio_nome);
    delete from public.piattaforme where id = piattaforma_id;
    return true;
  end if;

  update public.piattaforme set nome = nuovo_nome where id = piattaforma_id;

  -- Confronto esatto: una rinomina che cambia solo il case deve propagare.
  if v_vecchio_nome <> nuovo_nome then
    update public.prodotti
    set piattaforma_gioco = nuovo_nome
    where piattaforma_gioco is not null
      and lower(trim(piattaforma_gioco)) = lower(v_vecchio_nome);
  end if;
  return false;
end;
$$;

comment on function rinomina_piattaforma_con_propagazione(uuid, text) is
  'Rinomina una piattaforma propagando il nome ai prodotti; se il nuovo nome è già di un''altra piattaforma, unisce le due. Restituisce true in caso di unione.';

revoke all on function rinomina_piattaforma_con_propagazione(uuid, text) from public, anon;
grant execute on function rinomina_piattaforma_con_propagazione(uuid, text) to authenticated;

create or replace function scambia_ordine_piattaforme(id_a uuid, id_b uuid)
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
    select ordine into ord_a from public.piattaforme where id = id_a for update;
    select ordine into ord_b from public.piattaforme where id = id_b for update;
  else
    select ordine into ord_b from public.piattaforme where id = id_b for update;
    select ordine into ord_a from public.piattaforme where id = id_a for update;
  end if;

  if ord_a is null or ord_b is null then
    return;
  end if;

  update public.piattaforme set ordine = ord_b where id = id_a;
  update public.piattaforme set ordine = ord_a where id = id_b;
end;
$$;

comment on function scambia_ordine_piattaforme(uuid, uuid) is
  'Scambia ordine tra due piattaforme in modo atomico, con lock deterministico sulle due righe.';

revoke all on function scambia_ordine_piattaforme(uuid, uuid) from public, anon;
grant execute on function scambia_ordine_piattaforme(uuid, uuid) to authenticated;
