-- Le categorie prodotto si riducono a Videogiochi, Console, Controller,
-- Accessori. Ogni altro valore storico di `prodotti.categoria` (es. "PS5")
-- era in realtà una piattaforma: si sposta in `prodotti.piattaforma_gioco`.
--
-- Se il prodotto ha già una piattaforma, quella resta (dato più specifico) e
-- il vecchio valore di categoria viene scartato. La categoria torna NULL.
-- Idempotente: rieseguirla non tocca nulla.

-- 1. Valori fuori elenco: categoria -> piattaforma.
update public.prodotti
set piattaforma_gioco = coalesce(nullif(trim(piattaforma_gioco), ''), nullif(trim(categoria), '')),
    categoria = null
where categoria is not null
  and lower(trim(categoria)) not in ('videogiochi', 'console', 'controller', 'accessori');

-- 2. Valori ammessi: grafia canonica, indipendente da come sono scritte le
--    righe di `categorie` ("videogiochi " -> "Videogiochi").
update public.prodotti p
set categoria = c.canonico
from (values
  ('videogiochi', 'Videogiochi'),
  ('console', 'Console'),
  ('controller', 'Controller'),
  ('accessori', 'Accessori')
) as c(chiave, canonico)
where lower(trim(p.categoria)) = c.chiave
  and p.categoria <> c.canonico;

-- 3. Suggerimenti: via le voci fuori elenco...
delete from public.categorie
where lower(trim(nome)) not in ('videogiochi', 'console', 'controller', 'accessori');

-- 4. ...via i doppioni che differiscono solo per spazi/maiuscole (resta la
--    riga con `ordine` più basso)...
delete from public.categorie c
using public.categorie k
where lower(trim(c.nome)) = lower(trim(k.nome))
  and (k.ordine, k.id) < (c.ordine, c.id);

-- 5. ...e grafia canonica sulle rimaste. Dopo il passo 4 non ci sono
--    collisioni sull'indice univoco lower(nome).
update public.categorie c
set nome = m.canonico
from (values
  ('videogiochi', 'Videogiochi'),
  ('console', 'Console'),
  ('controller', 'Controller'),
  ('accessori', 'Accessori')
) as m(chiave, canonico)
where lower(trim(c.nome)) = m.chiave
  and c.nome <> m.canonico;
