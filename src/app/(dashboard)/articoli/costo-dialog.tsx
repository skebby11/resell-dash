"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { importoOpzionale } from "@/lib/validazione";
import type { Articolo } from "@/types";
import { aggiornaCostoAcquisto } from "./actions";

/** Corregge il costo d'acquisto di un articolo. */
export function CostoDialog({ articolo }: { articolo: Articolo }) {
  const [aperto, setAperto] = useState(false);
  const [costo, setCosto] = useState(String(articolo.costoAcquisto));
  const [errore, setErrore] = useState<string>();
  const [inCorso, startTransition] = useTransition();

  function salva(e: React.FormEvent) {
    e.preventDefault();
    const valore = importoOpzionale(costo);
    if (valore == null) {
      setErrore(
        valore === null ? "Indica il costo di acquisto." : "Il costo deve essere un numero non negativo."
      );
      return;
    }
    setErrore(undefined);
    startTransition(async () => {
      try {
        await aggiornaCostoAcquisto(articolo.id, valore);
        toast.success("Costo aggiornato");
        setAperto(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito.");
      }
    });
  }

  return (
    <Dialog
      open={aperto}
      onOpenChange={(o) => {
        setAperto(o);
        if (o) {
          setCosto(String(articolo.costoAcquisto));
          setErrore(undefined);
        }
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Modifica costo di ${articolo.prodottoNome}`}
      >
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Modifica costo di acquisto</DialogTitle>
          <DialogDescription>{articolo.prodottoNome}</DialogDescription>
        </DialogHeader>
        <form onSubmit={salva} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-costo">Costo acquisto (€)</Label>
            <Input
              id="c-costo"
              type="number"
              min="0"
              step="0.01"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              aria-invalid={Boolean(errore)}
            />
            {errore && <p className="text-xs text-destructive">{errore}</p>}
            {articolo.profitto != null && (
              <p className="text-xs text-muted-foreground">
                Il profitto dell&apos;articolo verrà ricalcolato.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={inCorso}>
              {inCorso ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
