"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Articolo, StatoArticolo } from "@/types";
import { puoArchiviareArticolo, puoEliminareArticolo } from "@/lib/validazione";
import { annullaVendita, archiviaArticolo, cambiaStato, eliminaArticolo, ripristinaArticolo } from "./actions";

/** Transizioni che non richiedono dati aggiuntivi, per stato di partenza. */
const TRANSIZIONI: Partial<Record<StatoArticolo, { stato: StatoArticolo; label: string }[]>> = {
  acquistato: [{ stato: "in vendita", label: "Metti in vendita" }],
  "in vendita": [{ stato: "acquistato", label: "Riporta in magazzino" }],
  venduto: [{ stato: "consegnato", label: "Segna come consegnato" }],
  consegnato: [{ stato: "venduto", label: "Riporta a «venduto»" }],
};

export function AzioniStato({ articolo }: { articolo: Articolo }) {
  const [inCorso, startTransition] = useTransition();
  // Le server action invocate fuori da un <form> vanno avvolte in una
  // transition, altrimenti il redirect/revalidate non viene applicato.
  const [confermaAnnulla, setConfermaAnnulla] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);
  const transizioni = TRANSIZIONI[articolo.stato] ?? [];
  const venduto = articolo.stato === "venduto" || articolo.stato === "consegnato";
  const archiviato = articolo.archiviatoAt != null;
  const mostraElimina = puoEliminareArticolo(articolo.stato);
  const mostraArchivia = puoArchiviareArticolo(articolo.stato, archiviato);
  const mostraRipristina = venduto && archiviato;

  function esegui(azione: () => Promise<void>, successo: string) {
    startTransition(async () => {
      try {
        await azione();
        toast.success(successo);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Operazione non riuscita.");
      }
    });
  }

  return (
    <DropdownMenu
      onOpenChange={(aperto) => {
        if (!aperto) {
          setConfermaAnnulla(false);
          setConfermaElimina(false);
        }
      }}
    >
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" disabled={inCorso} />}
        aria-label={`Azioni per ${articolo.prodottoNome}`}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 min-w-52">
        {transizioni.map((t) => (
          <DropdownMenuItem
            key={t.stato}
            onClick={() => esegui(() => cambiaStato(articolo.id, t.stato), t.label)}
          >
            {t.label}
          </DropdownMenuItem>
        ))}

        {venduto && (
          <>
            <DropdownMenuSeparator />
            {/* Doppio passaggio: annullare azzera data, prezzo, fee e spedizione,
                quindi è distruttivo e non deve dipendere da un click solo. */}
            <DropdownMenuItem
              variant="destructive"
              closeOnClick={confermaAnnulla}
              onClick={() => {
                if (!confermaAnnulla) {
                  setConfermaAnnulla(true);
                  return;
                }
                esegui(() => annullaVendita(articolo.id), "Vendita annullata");
              }}
            >
              {confermaAnnulla ? "Confermi? Cancella i dati di vendita" : "Annulla vendita"}
            </DropdownMenuItem>
          </>
        )}

        {mostraElimina && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              closeOnClick={confermaElimina}
              onClick={() => {
                if (!confermaElimina) {
                  setConfermaElimina(true);
                  return;
                }
                esegui(() => eliminaArticolo(articolo.id), "Articolo eliminato");
              }}
            >
              {confermaElimina ? "Confermi? Elimina dall'inventario" : "Elimina"}
            </DropdownMenuItem>
          </>
        )}

        {mostraArchivia && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => esegui(() => archiviaArticolo(articolo.id), "Articolo archiviato")}
            >
              Archivia
            </DropdownMenuItem>
          </>
        )}

        {mostraRipristina && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => esegui(() => ripristinaArticolo(articolo.id), "Articolo ripristinato")}
            >
              Ripristina
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
