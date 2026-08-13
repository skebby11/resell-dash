"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CirclePause, CirclePlay, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Categoria } from "@/types";
import {
  creaCategoria,
  eliminaCategoria,
  impostaAttivoCategoria,
  rinominaCategoria,
  spostaCategoria,
  type StatoCategoria,
} from "@/app/(dashboard)/impostazioni/actions";

/**
 * Gestione delle categorie prodotto: elenco con conteggio modelli, riordino,
 * rinomina, attivazione/disattivazione ed eliminazione. Clone dei canali
 * senza sezione orfani (la rinomina aggiorna sempre i prodotti).
 */

function BottoneSalvaAggiungi() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="size-4" />
      {pending ? "Aggiunta…" : "Aggiungi"}
    </Button>
  );
}

function BottoneSalvaRinomina() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Salvataggio…" : "Salva"}
    </Button>
  );
}

function messaggioElimina(n: number): string {
  return `Riassegna o svuota la categoria sui ${n} modell${n === 1 ? "o" : "i"} prima di eliminarla.`;
}

function RigaCategoria({ categoria }: { categoria: Categoria }) {
  const [inModifica, setInModifica] = useState(false);
  const [nome, setNome] = useState(categoria.nome);
  const [inCorso, startTransition] = useTransition();
  const nonEliminabile = categoria.conteggioProdotti > 0;
  const titoloElimina = nonEliminabile
    ? messaggioElimina(categoria.conteggioProdotti)
    : `Elimina ${categoria.nome}`;
  // Il toast e la chiusura del modulo avvengono qui, non in un effect
  // sull'esito: `useActionState` esegue questo wrapper dentro la transition
  // dell'azione, quindi aggiornare lo stato locale a quel punto è un
  // aggiornamento guidato da un evento (stessa scelta di canali-manager).
  const [statoRinomina, azioneRinomina] = useActionState<StatoCategoria, FormData>(
    async (precedente, formData) => {
      const esito = await rinominaCategoria(precedente, formData);
      if (esito.ok) {
        toast.success("Categoria rinominata");
        setInModifica(false);
      } else if (esito.errore) {
        toast.error(esito.errore);
      }
      return esito;
    },
    { seq: 0 }
  );

  function sposta(direzione: "su" | "giu") {
    startTransition(async () => {
      try {
        await spostaCategoria(categoria.id, direzione);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Spostamento non riuscito.");
      }
    });
  }

  function toggleAttivo() {
    startTransition(async () => {
      try {
        await impostaAttivoCategoria(categoria.id, !categoria.attivo);
        toast.success(categoria.attivo ? "Categoria disattivata" : "Categoria riattivata");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Operazione non riuscita.");
      }
    });
  }

  function elimina() {
    startTransition(async () => {
      try {
        await eliminaCategoria(categoria.id);
        toast.success("Categoria eliminata");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eliminazione non riuscita.");
      }
    });
  }

  if (inModifica) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2.5">
        <form action={azioneRinomina} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={categoria.id} />
          <div className="flex items-center gap-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              name="nome"
              autoFocus
              className="h-8"
              aria-invalid={Boolean(statoRinomina.errore)}
            />
            <BottoneSalvaRinomina />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setInModifica(false);
                setNome(categoria.nome);
              }}
              aria-label="Annulla rinomina"
            >
              <X className="size-4" />
            </Button>
          </div>
          {statoRinomina.errore && <p className="text-xs text-destructive">{statoRinomina.errore}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-4"
            onClick={() => sposta("su")}
            disabled={inCorso}
            aria-label="Sposta su"
          >
            <ArrowUp className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-4"
            onClick={() => sposta("giu")}
            disabled={inCorso}
            aria-label="Sposta giù"
          >
            <ArrowDown className="size-3" />
          </Button>
        </div>
        <span className={cn("truncate text-sm", !categoria.attivo && "text-muted-foreground line-through")}>
          {categoria.nome}
        </span>
        <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
          {categoria.conteggioProdotti} modell{categoria.conteggioProdotti === 1 ? "o" : "i"}
        </Badge>
        {!categoria.attivo && (
          <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
            Disattivato
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setInModifica(true)}
          aria-label={`Rinomina ${categoria.nome}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleAttivo}
          disabled={inCorso}
          aria-label={categoria.attivo ? `Disattiva ${categoria.nome}` : `Riattiva ${categoria.nome}`}
          title={categoria.attivo ? "Disattiva: non più suggerita nei form" : "Riattiva"}
        >
          {categoria.attivo ? <CirclePause className="size-3.5" /> : <CirclePlay className="size-3.5" />}
        </Button>
        <span title={titoloElimina}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={elimina}
            disabled={inCorso || nonEliminabile}
            aria-label={`Elimina ${categoria.nome}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
    </li>
  );
}

export function CategorieManager({ categorie }: { categorie: Categoria[] }) {
  const [nomeNuovo, setNomeNuovo] = useState("");
  // Stesso motivo del wrapper in RigaCategoria: niente effect su `stato.seq`.
  const [, azione] = useActionState<StatoCategoria, FormData>(async (precedente, formData) => {
    const esito = await creaCategoria(precedente, formData);
    if (esito.ok) {
      toast.success("Categoria aggiunta");
      setNomeNuovo("");
    } else if (esito.errore) {
      toast.error(esito.errore);
    }
    return esito;
  }, { seq: 0 });

  return (
    <div className="flex flex-col gap-3">
      {categorie.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {categorie.map((c) => (
            <RigaCategoria key={c.id} categoria={c} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nessuna categoria configurata.</p>
      )}

      <form action={azione} className="flex items-center gap-2">
        <Input
          name="nome"
          value={nomeNuovo}
          onChange={(e) => setNomeNuovo(e.target.value)}
          placeholder="Nuova categoria…"
          aria-label="Nome della categoria"
          className="h-8"
        />
        <BottoneSalvaAggiungi />
      </form>
    </div>
  );
}
