-- barcode e foto_url esistono già dallo schema iniziale (0001_init.sql) ma
-- finora restavano sempre NULL: l'import dal foglio non portava codici a
-- barre. Con il lookup barcode → catalogo interno → UPCitemdb → IGDB, la
-- colonna comincia a essere scritta dall'app (o a mano), quindi le merita un
-- vincolo di formato come le altre colonne numeriche della tabella: la
-- normalizzazione "autorevole" resta in src/lib/integrations/barcode.ts, ma
-- un client che la saltasse non deve poter scrivere codici non
-- EAN-8/UPC-A/EAN-13 (8, 12 o 13 cifre). Nessuna riga esistente ha barcode
-- valorizzato, quindi il vincolo non ha nulla da violare all'atto della
-- migration.
alter table prodotti
  add constraint prodotti_barcode_formato
  check (barcode is null or barcode ~ '^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$');

comment on column prodotti.barcode is
  'Codice a barre EAN-8/UPC-A/EAN-13, normalizzato a sole cifre. Chiave di deduplica più affidabile del nome nel form di inserimento.';
comment on column prodotti.foto_url is
  'URL della copertina prodotto, tipicamente da IGDB (https://images.igdb.com/igdb/image/upload/t_cover_big/<image_id>.jpg).';
