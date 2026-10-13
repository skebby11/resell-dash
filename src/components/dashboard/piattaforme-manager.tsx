"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CirclePause, CirclePlay, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PiattaformaGioco as Piattaforma } from "@/types";
import {
  creaPiattaforma,
  eliminaPiattaforma,
  impostaAttivoPiattaforma,
  rinominaPiattaforma,
  spostaPiattaforma,
  type StatoPiattaforma,
} from "@/app/(dashboard)/impostazioni/actions";

/**
 * Gestione delle piattaforme di gioco: elenco con conteggio modelli, riordino,
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
  return `Riassegna o svuota la piattaforma sui ${n} modell${n === 1 ? "o" : "i"} prima di eliminarla.`;
}

function RigaPiattaforma({ piattaforma }: { piattaforma: Piattaforma }) {
  const [inModifica, setInModifica] = useState(false);
  const [nome, setNome] = useState(piattaforma.nome);
  const [inCorso, startTransition] = useTransition();
  const nonEliminabile = piattaforma.conteggioProdotti > 0;
  const titoloElimina = nonEliminabile
    ? messaggioElimina(piattaforma.conteggioProdotti)
    : `Elimina ${piattaforma.nome}`;
  // Il toast e la chiusura del modulo avvengono qui, non in un effect
  // sull'esito: `useActionState` esegue questo wrapper dentro la transition
  // dell'azione, quindi aggiornare lo stato locale a quel punto è un
  // aggiornamento guidato da un evento (stessa scelta di canali-manager).
  const [statoRinomina, azioneRinomina] = useActionState<StatoPiattaforma, FormData>(
    async (precedente, formData) => {
      const esito = await rinominaPiattaforma(precedente, formData);
      if (esito.ok) {
        toast.success("Piattaforma rinominata");
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
        await spostaPiattaforma(piattaforma.id, direzione);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Spostamento non riuscito.");
      }
    });
  }

  function toggleAttivo() {
    startTransition(async () => {
      try {
        await impostaAttivoPiattaforma(piattaforma.id, !piattaforma.attivo);
        toast.success(piattaforma.attivo ? "Piattaforma disattivata" : "Piattaforma riattivata");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Operazione non riuscita.");
      }
    });
  }

  function elimina() {
    startTransition(async () => {
      try {
        await eliminaPiattaforma(piattaforma.id);
        toast.success("Piattaforma eliminata");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eliminazione non riuscita.");
      }
    });
  }

  if (inModifica) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2.5">
        <form action={azioneRinomina} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={piattaforma.id} />
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
                setNome(piattaforma.nome);
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
        <span className={cn("truncate text-sm", !piattaforma.attivo && "text-muted-foreground line-through")}>
          {piattaforma.nome}
        </span>
        <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
          {piattaforma.conteggioProdotti} modell{piattaforma.conteggioProdotti === 1 ? "o" : "i"}
        </Badge>
        {!piattaforma.attivo && (
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
          aria-label={`Rinomina ${piattaforma.nome}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleAttivo}
          disabled={inCorso}
          aria-label={piattaforma.attivo ? `Disattiva ${piattaforma.nome}` : `Riattiva ${piattaforma.nome}`}
          title={piattaforma.attivo ? "Disattiva: non più suggerita nei form" : "Riattiva"}
        >
          {piattaforma.attivo ? <CirclePause className="size-3.5" /> : <CirclePlay className="size-3.5" />}
        </Button>
        <span title={titoloElimina}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={elimina}
            disabled={inCorso || nonEliminabile}
            aria-label={`Elimina ${piattaforma.nome}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
    </li>
  );
}

export function PiattaformeManager({ piattaforme }: { piattaforme: Piattaforma[] }) {
  const [nomeNuovo, setNomeNuovo] = useState("");
  // Stesso motivo del wrapper in RigaPiattaforma: niente effect su `stato.seq`.
  const [, azione] = useActionState<StatoPiattaforma, FormData>(async (precedente, formData) => {
    const esito = await creaPiattaforma(precedente, formData);
    if (esito.ok) {
      toast.success("Piattaforma aggiunta");
      setNomeNuovo("");
    } else if (esito.errore) {
      toast.error(esito.errore);
    }
    return esito;
  }, { seq: 0 });

  return (
    <div className="flex flex-col gap-3">
      {piattaforme.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {piattaforme.map((c) => (
            <RigaPiattaforma key={c.id} piattaforma={c} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nessuna piattaforma configurata.</p>
      )}

      <form action={azione} className="flex items-center gap-2">
        <Input
          name="nome"
          value={nomeNuovo}
          onChange={(e) => setNomeNuovo(e.target.value)}
          placeholder="Nuova piattaforma…"
          aria-label="Nome della piattaforma"
          className="h-8"
        />
        <BottoneSalvaAggiungi />
      </form>
    </div>
  );
}
