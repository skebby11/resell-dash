-- Archivio venduti: `archiviato_at` nasconde l'articolo dalla lista Articoli
-- di default, senza toglierlo da KPI, andamento mensile e Vendite UE.
-- Nessun CHECK sullo stato: l'action rifiuta l'archivio sugli invenduti
-- con un errore leggibile, e un vincolo bloccherebbe un futuro
-- "ripristina poi annulla vendita" se i due UPDATE non fossero atomici.

alter table articoli add column if not exists archiviato_at timestamptz;

comment on column articoli.archiviato_at is
  'Non null = nascosto dalla lista Articoli di default. Resta in KPI, andamento mensile e Vendite UE.';

create index if not exists idx_articoli_non_archivio
  on articoli (data_acquisto desc, id)
  where archiviato_at is null;
