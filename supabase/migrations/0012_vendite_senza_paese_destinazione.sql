-- Rifinitura /vendite-ue: il gruppo "senza paese noto" mescolava due lacune
-- diverse. `destinazione = 'Estero'` con paese ignoto è una vendita
-- CERTAMENTE fuori Italia (manca solo quale paese UE); `destinazione` NULL
-- non dice nemmeno quello (potrebbe essere italiana). Sono due correzioni
-- diverse da fare sui dati, e soprattutto due livelli diversi di certezza da
-- non appiattire in un'unica riga "senza paese": la UI deve poter mostrare un
-- minimo certo di venduto fuori Italia (paese noto + 'Estero' non censito) e
-- un massimo possibile (+ destinazione ignota), invece di un'unica somma che
-- nasconde quanto è già certo.
--
-- Si aggiunge `destinazione` in coda alle colonne esistenti (CREATE OR REPLACE
-- VIEW può solo accodare colonne, non alterare o riordinare quelle esistenti):
-- nessuna riga nuova per i paesi già noti, perché il CHECK
-- articoli_paese_destinazione_coerenti (0009) lega deterministicamente
-- paese_vendita a destinazione quando il paese è noto. Solo il gruppo
-- paese_vendita NULL si sdoppia, in 'Estero' e NULL.
create or replace view v_vendite_per_paese_anno
  with (security_invoker = true) as
select
  extract(year from data_vendita)::int as anno,
  paese_vendita as paese,
  count(*) as numero_vendite,
  coalesce(round(sum(prezzo_vendita), 2), 0) as totale_vendite,
  coalesce(round(sum(profitto), 2), 0) as profitto_totale,
  destinazione
from articoli
where stato in ('venduto', 'consegnato') and data_vendita is not null
group by extract(year from data_vendita), paese_vendita, destinazione
order by anno, paese nulls last, destinazione nulls last;

comment on view v_vendite_per_paese_anno is
  'Vendite (venduto/consegnato) per paese UE e anno solare. paese NULL = vendita senza paese noto (da correggere da /articoli); per quelle righe, destinazione distingue "Estero" (certamente fuori Italia, paese ignoto) da NULL (destinazione stessa ignota).';
