-- Le categorie prodotto si riducono a Videogiochi, Console, Controller,
-- Accessori. Ogni altro valore storico di `prodotti.categoria` (es. "PS5")
-- era in realtà una piattaforma: si sposta in `prodotti.piattaforma_gioco`.
--
-- Se il prodotto ha già una piattaforma, quella resta (dato più specifico) e
-- il vecchio valore di categoria viene scartato. La categoria torna NULL.
-- Idempotente: rieseguirla non tocca nulla.

update public.prodotti
set piattaforma_gioco = coalesce(nullif(trim(piattaforma_gioco), ''), trim(categoria)),
    categoria = null
where categoria is not null
  and lower(trim(categoria)) not in ('videogiochi', 'console', 'controller', 'accessori');

-- Uniforma la grafia delle quattro rimaste ("videogiochi " -> "Videogiochi").
update public.prodotti p
set categoria = c.nome
from public.categorie c
where p.categoria is not null
  and lower(trim(p.categoria)) = lower(c.nome)
  and p.categoria <> c.nome
  and lower(c.nome) in ('videogiochi', 'console', 'controller', 'accessori');

-- Elenco suggerimenti: solo le quattro categorie.
delete from public.categorie
where lower(trim(nome)) not in ('videogiochi', 'console', 'controller', 'accessori');
