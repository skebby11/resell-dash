-- Note per singolo esemplare.
--
-- Il form di inserimento ha sempre avuto un campo "Note" (stato estetico,
-- accessori inclusi, difetti), ma non esisteva una colonna dove scriverlo.
-- Sono dati dell'esemplare, non del modello: metterli su `prodotti` li
-- condividerebbe con tutti gli articoli dello stesso modello.
alter table articoli add column if not exists note text;

comment on column articoli.note is 'Note libere sul singolo esemplare: stato estetico, accessori, difetti.';
