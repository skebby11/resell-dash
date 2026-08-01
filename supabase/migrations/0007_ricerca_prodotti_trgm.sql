-- Ricerca ilike('%testo%') su prodotti.nome non puo' sfruttare un B-tree: degrada
-- a seq scan. Al volume attuale (850 righe) costa ~1-2ms e passa inosservato;
-- misurato a 10x (tabella di scratch da 8500 righe, stessa distribuzione dei
-- nomi) il seq scan sale a ~10ms mentre un indice GIN trigram lo riporta a
-- ~1ms. Copre sia /catalogo (ricerca diretta su nome) sia /articoli, che
-- filtra sullo stesso campo attraverso l'embed prodotti!inner.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_prodotti_nome_trgm
  on prodotti using gin (nome gin_trgm_ops);
