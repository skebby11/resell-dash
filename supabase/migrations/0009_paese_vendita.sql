-- Paese di vendita, per l'obbligo di legge di sapere quanto si è venduto in
-- ciascun paese UE per anno solare. `destinazione` ('Italia'/'Estero'/NULL) non
-- basta: per le vendite estere non dice quale paese.
--
-- Non sostituisce `destinazione`: per le vendite estere storiche il paese non
-- è noto e non va indovinato, mentre "estero, paese ignoto" resta comunque
-- un'informazione (quella che già c'è). Le due colonne restano quindi
-- entrambe, ma non come due fonti di verità indipendenti: il CHECK sotto
-- impone la coerenza, così l'invariante lo garantisce il database e non la
-- disciplina di chi scrive il codice applicativo.

alter table articoli add column paese_vendita text;

comment on column articoli.paese_vendita is
  'Codice ISO 3166-1 alpha-2 del paese di vendita, tra i 27 stati membri UE. NULL = paese non noto (storico, o vendita estera non ancora censita).';

-- Backfill: 'Italia' -> 'IT'. 'Estero' e NULL restano NULL (il paese non è
-- ricavabile da 'Estero' senza inventarlo) e non richiedono un UPDATE perché
-- la colonna appena creata è già NULL di default per ogni riga.
update articoli set paese_vendita = 'IT' where destinazione = 'Italia';

-- Elenco esatto dei 27 stati membri UE (verificato, non a memoria: il Regno
-- Unito non ne fa più parte da Brexit; Norvegia/Svizzera/Islanda non sono mai
-- state membri UE pur essendo nello spazio economico/Schengen).
alter table articoli
  add constraint articoli_paese_vendita_valido
  check (
    paese_vendita is null
    or paese_vendita in (
      'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR',
      'DE','GR','HU','IE','IT','LV','LT','LU','MT','NL',
      'PL','PT','RO','SK','SI','ES','SE'
    )
  );

-- Coerenza fra le due colonne, imposta dal database e non dall'applicazione:
-- paese noto e Italia => destinazione deve dire 'Italia'; paese noto e non
-- Italia => destinazione deve dire 'Estero'. Paese ignoto (NULL) non vincola
-- nulla, per non rompere lo storico pre-esistente.
alter table articoli
  add constraint articoli_paese_destinazione_coerenti
  check (
    paese_vendita is null
    or (paese_vendita = 'IT' and destinazione = 'Italia')
    or (paese_vendita <> 'IT' and destinazione = 'Estero')
  );

-- A supporto del filtro "vendite senza paese" (per isolarle e correggerle da
-- /articoli) e delle aggregazioni per paese/anno.
create index if not exists idx_articoli_paese_vendita on articoli (paese_vendita);
