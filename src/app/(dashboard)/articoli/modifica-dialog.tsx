"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Articolo } from "@/types";
import { modificaArticolo, type StatoModifica } from "./actions";

function BottoneSalva() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" />
      {pending ? "Salvataggio…" : "Salva modifiche"}
    </Button>
  );
}

function Errore({ testo }: { testo?: string }) {
  return testo ? <p className="text-xs text-destructive">{testo}</p> : null;
}

/** Modifica di un articolo già registrato (prodotto, categoria, piattaforma, acquisto, note). */
export function ModificaDialog({
  articolo,
  categorie,
  piattaforme,
  fontiAcquisto,
}: {
  articolo: Articolo;
  /** Suggerimenti attivi letti dal database (categorie 0015, piattaforme 0023, canali 0013). */
  categorie: string[];
  piattaforme: string[];
  fontiAcquisto: string[];
}) {
  const [stato, action] = useActionState<StatoModifica, FormData>(modificaArticolo, { seq: 0 });

  useEffect(() => {
    if (stato.seq > 0) toast.success("Articolo aggiornato");
  }, [stato.seq]);

  // Errore o avviso non bloccante (suggerimento non aggiunto a un salvataggio riuscito).
  useEffect(() => {
    if (!stato.errore) return;
    if (stato.ok) toast.warning(stato.errore);
    else toast.error(stato.errore);
  }, [stato.errore, stato.ok]);

  const sfx = articolo.id;

  return (
    // `key` sul Dialog: a salvataggio riuscito si rimonta e torna chiuso
    // (stessa scelta di VenditaDialog, per la regola lint set-state-in-effect).
    <Dialog key={stato.seq}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Modifica ${articolo.prodottoNome}`}
      >
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifica articolo</DialogTitle>
          <DialogDescription>{articolo.prodottoNome}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={articolo.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`m-prodotto-${sfx}`}>Prodotto *</Label>
            <Input
              id={`m-prodotto-${sfx}`}
              name="prodotto"
              defaultValue={articolo.prodottoNome}
              autoComplete="off"
              aria-invalid={Boolean(stato.campi?.prodotto)}
            />
            <Errore testo={stato.campi?.prodotto} />
            <p className="text-xs text-muted-foreground">
              Con un altro nome l&apos;articolo passa a quel modello (creato se non esiste).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`m-categoria-${sfx}`}>Categoria</Label>
              <Input
                id={`m-categoria-${sfx}`}
                name="categoria"
                list={`m-lista-categorie-${sfx}`}
                autoComplete="off"
                defaultValue={articolo.categoria ?? ""}
                placeholder="Videogiochi, Console…"
              />
              <datalist id={`m-lista-categorie-${sfx}`}>
                {categorie.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`m-piattaforma-${sfx}`}>Piattaforma</Label>
              <Input
                id={`m-piattaforma-${sfx}`}
                name="piattaforma_gioco"
                list={`m-lista-piattaforme-${sfx}`}
                autoComplete="off"
                defaultValue={articolo.piattaformaGioco ?? ""}
                placeholder="PS5, Switch…"
              />
              <datalist id={`m-lista-piattaforme-${sfx}`}>
                {piattaforme.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Categoria e piattaforma sono del modello: cambiandole valgono per tutte le sue copie.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`m-data-${sfx}`}>Data acquisto *</Label>
              <Input
                id={`m-data-${sfx}`}
                name="data_acquisto"
                type="date"
                defaultValue={articolo.dataAcquisto}
                aria-invalid={Boolean(stato.campi?.data_acquisto)}
              />
              <Errore testo={stato.campi?.data_acquisto} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`m-costo-${sfx}`}>Costo acquisto (€) *</Label>
              <Input
                id={`m-costo-${sfx}`}
                name="costo_acquisto"
                type="number"
                min="0"
                step="0.01"
                defaultValue={String(articolo.costoAcquisto)}
                aria-invalid={Boolean(stato.campi?.costo_acquisto)}
              />
              <Errore testo={stato.campi?.costo_acquisto} />
              {articolo.profitto != null && (
                <p className="text-xs text-muted-foreground">Il profitto verrà ricalcolato.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`m-fonte-${sfx}`}>Fonte acquisto *</Label>
            <Input
              id={`m-fonte-${sfx}`}
              name="fonte_acquisto"
              list={`m-lista-fonti-${sfx}`}
              autoComplete="off"
              defaultValue={articolo.fonteAcquisto}
              aria-invalid={Boolean(stato.campi?.fonte_acquisto)}
            />
            <datalist id={`m-lista-fonti-${sfx}`}>
              {fontiAcquisto.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <Errore testo={stato.campi?.fonte_acquisto} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`m-note-${sfx}`}>Note</Label>
            <Textarea
              id={`m-note-${sfx}`}
              name="note"
              defaultValue={articolo.note ?? ""}
              placeholder="Stato estetico, accessori inclusi, difetti…"
            />
          </div>

          <DialogFooter>
            <BottoneSalva />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
