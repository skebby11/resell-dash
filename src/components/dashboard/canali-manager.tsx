"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CirclePause, CirclePlay, Pencil, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Canale, TipoCanale } from "@/types";
import {
  creaCanale,
  impostaAttivoCanale,
  rinominaCanale,
  spostaCanale,
  type StatoCanale,
  type StatoRinomina,
} from "@/app/(dashboard)/impostazioni/actions";

/**
 * Gestione dei canali di un tipo (piattaforma di vendita, fonte di acquisto o
 * spedizioniere): elenco con conteggio articoli, riordino, rinomina e
 * attivazione/disattivazione. Un'istanza per tipo nella pagina Impostazioni.
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

function RigaCanale({ canale }: { canale: Canale }) {
  const [inModifica, setInModifica] = useState(false);
  const [nome, setNome] = useState(canale.nome);
  const [aggiornaStorico, setAggiornaStorico] = useState(false);
  const [inCorso, startTransition] = useTransition();
  // Il toast e la chiusura del modulo avvengono qui, non in un effect
  // sull'esito: `useActionState` esegue questo wrapper dentro la transition
  // dell'azione, quindi aggiornare lo stato locale a quel punto è un
  // aggiornamento guidato da un evento, non un setState sincrono in un effect
  // (che innescherebbe render a cascata — vedi la stessa scelta in
  // inserimento-form.tsx/vendita-dialog.tsx, lì risolta con `key` invece).
  const [statoRinomina, azioneRinomina] = useActionState<StatoRinomina, FormData>(
    async (precedente, formData) => {
      const esito = await rinominaCanale(precedente, formData);
      if (esito.ok) {
        toast.success("Canale rinominato");
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
        await spostaCanale(canale.id, direzione);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Spostamento non riuscito.");
      }
    });
  }

  function toggleAttivo() {
    startTransition(async () => {
      try {
        await impostaAttivoCanale(canale.id, !canale.attivo);
        toast.success(canale.attivo ? "Canale disattivato" : "Canale riattivato");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Operazione non riuscita.");
      }
    });
  }

  if (inModifica) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2.5">
        <form action={azioneRinomina} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={canale.id} />
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
                setNome(canale.nome);
              }}
              aria-label="Annulla rinomina"
            >
              <X className="size-4" />
            </Button>
          </div>
          {/* Esplicito di proposito (vedi actions.ts): una rinomina silenziosa
              scollegherebbe lo storico dalle statistiche senza che nessuno se
              ne accorga. */}
          {canale.conteggioArticoli > 0 && (
            <Label className="flex items-start gap-2 text-xs font-normal text-muted-foreground">
              <Checkbox
                name="aggiorna_storico"
                checked={aggiornaStorico}
                onCheckedChange={(v) => setAggiornaStorico(v === true)}
                className="mt-0.5"
              />
              <span>
                Aggiorna anche i <strong>{canale.conteggioArticoli}</strong> articoli esistenti con
                «{canale.nome}»: da «{canale.nome}» a «{nome || canale.nome}». Se non spuntato, quegli
                articoli mantengono «{canale.nome}» e continuano a comparire nelle statistiche come
                voce separata dal canale rinominato.
              </span>
            </Label>
          )}
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
        <span className={cn("truncate text-sm", !canale.attivo && "text-muted-foreground line-through")}>
          {canale.nome}
        </span>
        <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
          {canale.conteggioArticoli} articol{canale.conteggioArticoli === 1 ? "o" : "i"}
        </Badge>
        {!canale.attivo && (
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
          aria-label={`Rinomina ${canale.nome}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleAttivo}
          disabled={inCorso}
          aria-label={canale.attivo ? `Disattiva ${canale.nome}` : `Riattiva ${canale.nome}`}
          title={canale.attivo ? "Disattiva: non più suggerito nei form" : "Riattiva"}
        >
          {canale.attivo ? <CirclePause className="size-3.5" /> : <CirclePlay className="size-3.5" />}
        </Button>
      </div>
    </li>
  );
}

export function CanaliManager({
  tipo,
  etichetta,
  canali,
  orfani,
}: {
  tipo: TipoCanale;
  etichetta: string;
  canali: Canale[];
  orfani: { nome: string; conteggioArticoli: number }[];
}) {
  const [nomeNuovo, setNomeNuovo] = useState("");
  // Stesso motivo del wrapper in RigaCanale: niente effect su `stato.seq`.
  const [, azione] = useActionState<StatoCanale, FormData>(async (precedente, formData) => {
    const esito = await creaCanale(precedente, formData);
    if (esito.ok) {
      toast.success("Canale aggiunto");
      setNomeNuovo("");
    } else if (esito.errore) {
      toast.error(esito.errore);
    }
    return esito;
  }, { seq: 0 });

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">{etichetta}</h3>

      {canali.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {canali.map((c) => (
            <RigaCanale key={c.id} canale={c} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nessun canale configurato.</p>
      )}

      <form action={azione} className="flex items-center gap-2">
        <input type="hidden" name="tipo" value={tipo} />
        <Input
          name="nome"
          value={nomeNuovo}
          onChange={(e) => setNomeNuovo(e.target.value)}
          placeholder="Nuovo canale…"
          className="h-8"
        />
        <BottoneSalvaAggiungi />
      </form>

      {orfani.length > 0 && (
        <div className="rounded-md bg-secondary/60 p-2.5 text-xs text-muted-foreground">
          <p className="mb-1.5 font-medium text-foreground">
            Nello storico ma senza un canale configurato
          </p>
          <ul className="flex flex-col gap-1">
            {orfani.map((o) => (
              <li key={o.nome} className="flex items-center justify-between gap-2">
                <span>
                  «{o.nome}» — {o.conteggioArticoli} articol{o.conteggioArticoli === 1 ? "o" : "i"}
                </span>
                <form action={azione}>
                  <input type="hidden" name="tipo" value={tipo} />
                  <input type="hidden" name="nome" value={o.nome} />
                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    Aggiungi come canale
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
