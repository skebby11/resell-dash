"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CirclePause, CirclePlay, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Paese } from "@/types";
import {
  creaPaese,
  eliminaPaese,
  impostaAttivoPaese,
  impostaPaeseOrigine,
  rinominaPaese,
  spostaPaese,
  type StatoPaese,
} from "@/app/(dashboard)/impostazioni/actions";

/**
 * Gestione dei paesi di vendita: elenco con conteggio articoli, riordino,
 * rinomina (nome e flag UE), attivazione/disattivazione ed eliminazione.
 * Il codice ISO è immutabile dopo l'insert. In cima, il paese di origine
 * dell'installazione (destinazione «Italia» nei form).
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

function BottoneSalva() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Salvataggio…" : "Salva"}
    </Button>
  );
}

function RigaPaese({ paese, paeseOrigine }: { paese: Paese; paeseOrigine: string }) {
  const [inModifica, setInModifica] = useState(false);
  const [nome, setNome] = useState(paese.nome);
  const [ue, setUe] = useState(paese.ue);
  const [inCorso, startTransition] = useTransition();
  const eOrigine = paese.codice === paeseOrigine;
  const nonEliminabile = eOrigine || paese.conteggioArticoli > 0;
  const titoloElimina = eOrigine
    ? "Non puoi eliminare il paese di origine. Cambialo prima."
    : paese.conteggioArticoli > 0
      ? `Non puoi eliminare un paese usato da ${paese.conteggioArticoli} articol${paese.conteggioArticoli === 1 ? "o" : "i"}.`
      : `Elimina ${paese.nome}`;
  // Il toast e la chiusura del modulo avvengono qui, non in un effect
  // sull'esito: `useActionState` esegue questo wrapper dentro la transition
  // dell'azione, quindi aggiornare lo stato locale a quel punto è un
  // aggiornamento guidato da un evento (stessa scelta di canali-manager).
  const [statoRinomina, azioneRinomina] = useActionState<StatoPaese, FormData>(
    async (precedente, formData) => {
      const esito = await rinominaPaese(precedente, formData);
      if (esito.ok) {
        toast.success("Paese aggiornato");
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
        await spostaPaese(paese.codice, direzione);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Spostamento non riuscito.");
      }
    });
  }

  function toggleAttivo() {
    startTransition(async () => {
      try {
        await impostaAttivoPaese(paese.codice, !paese.attivo);
        toast.success(paese.attivo ? "Paese disattivato" : "Paese riattivato");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Operazione non riuscita.");
      }
    });
  }

  function elimina() {
    startTransition(async () => {
      try {
        await eliminaPaese(paese.codice);
        toast.success("Paese eliminato");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Eliminazione non riuscita.");
      }
    });
  }

  if (inModifica) {
    return (
      <li className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2.5">
        <form action={azioneRinomina} className="flex flex-col gap-2">
          <input type="hidden" name="codice" value={paese.codice} />
          <div className="flex items-center gap-2">
            <span className="font-mono-num w-8 shrink-0 text-xs text-muted-foreground">{paese.codice}</span>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              name="nome"
              autoFocus
              className="h-8"
              aria-invalid={Boolean(statoRinomina.errore)}
            />
            <BottoneSalva />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setInModifica(false);
                setNome(paese.nome);
                setUe(paese.ue);
              }}
              aria-label="Annulla modifica"
            >
              <X className="size-4" />
            </Button>
          </div>
          <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            <Checkbox name="ue" checked={ue} onCheckedChange={(v) => setUe(v === true)} />
            Membro UE (conteggiato in Vendite UE)
          </Label>
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
        <span className="font-mono-num w-8 shrink-0 text-xs text-muted-foreground">{paese.codice}</span>
        <span className={cn("truncate text-sm", !paese.attivo && "text-muted-foreground line-through")}>
          {paese.nome}
        </span>
        {paese.ue && (
          <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
            UE
          </Badge>
        )}
        {eOrigine && (
          <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
            Origine
          </Badge>
        )}
        <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
          {paese.conteggioArticoli} articol{paese.conteggioArticoli === 1 ? "o" : "i"}
        </Badge>
        {!paese.attivo && (
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
          aria-label={`Modifica ${paese.nome}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <span
          title={
            eOrigine && paese.attivo
              ? "Non puoi disattivare il paese di origine. Cambialo prima."
              : paese.attivo
                ? "Disattiva: non più suggerito nei form"
                : "Riattiva"
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleAttivo}
            disabled={inCorso || (eOrigine && paese.attivo)}
            aria-label={paese.attivo ? `Disattiva ${paese.nome}` : `Riattiva ${paese.nome}`}
          >
            {paese.attivo ? <CirclePause className="size-3.5" /> : <CirclePlay className="size-3.5" />}
          </Button>
        </span>
        <span title={titoloElimina}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={elimina}
            disabled={inCorso || nonEliminabile}
            aria-label={`Elimina ${paese.nome}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
    </li>
  );
}

export function PaesiManager({ paesi, paeseOrigine }: { paesi: Paese[]; paeseOrigine: string }) {
  const [codiceNuovo, setCodiceNuovo] = useState("");
  const [nomeNuovo, setNomeNuovo] = useState("");
  const [ueNuovo, setUeNuovo] = useState(false);
  const [origineScelta, setOrigineScelta] = useState(paeseOrigine);
  // Stesso motivo del wrapper in RigaPaese: niente effect su `stato.seq`.
  const [, azione] = useActionState<StatoPaese, FormData>(async (precedente, formData) => {
    const esito = await creaPaese(precedente, formData);
    if (esito.ok) {
      toast.success("Paese aggiunto");
      setCodiceNuovo("");
      setNomeNuovo("");
      setUeNuovo(false);
    } else if (esito.errore) {
      toast.error(esito.errore);
    }
    return esito;
  }, { seq: 0 });

  const [, azioneOrigine] = useActionState<StatoPaese, FormData>(async (precedente, formData) => {
    const esito = await impostaPaeseOrigine(precedente, formData);
    if (esito.ok) {
      toast.success("Paese di origine aggiornato");
    } else if (esito.errore) {
      toast.error(esito.errore);
    }
    return esito;
  }, { seq: 0 });

  const paesiOrigine = paesi.filter((p) => p.attivo || p.codice === paeseOrigine);

  return (
    <div className="flex flex-col gap-4">
      <form action={azioneOrigine} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="paese-origine">Paese di origine</Label>
          <p className="text-xs text-muted-foreground">
            Destinazione «Italia» nei form corrisponde a questo paese.
          </p>
          <input type="hidden" name="codice" value={origineScelta} />
          <Select value={origineScelta} onValueChange={(v) => { if (v) setOrigineScelta(v); }}>
            <SelectTrigger id="paese-origine" className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paesiOrigine.map((p) => (
                <SelectItem key={p.codice} value={p.codice}>
                  {p.codice} — {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <BottoneSalva />
      </form>

      {paesi.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {paesi.map((p) => (
            <RigaPaese key={p.codice} paese={p} paeseOrigine={paeseOrigine} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nessun paese configurato.</p>
      )}

      <form action={azione} className="flex flex-wrap items-center gap-2">
        <Input
          name="codice"
          value={codiceNuovo}
          onChange={(e) => setCodiceNuovo(e.target.value.toUpperCase())}
          placeholder="IT"
          maxLength={2}
          autoComplete="off"
          spellCheck={false}
          aria-label="Codice ISO"
          className="h-8 w-16 uppercase"
        />
        <Input
          name="nome"
          value={nomeNuovo}
          onChange={(e) => setNomeNuovo(e.target.value)}
          placeholder="Nuovo paese…"
          aria-label="Nome del paese"
          className="h-8 min-w-40 flex-1"
        />
        <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          <Checkbox name="ue" checked={ueNuovo} onCheckedChange={(v) => setUeNuovo(v === true)} />
          UE
        </Label>
        <BottoneSalvaAggiungi />
      </form>
    </div>
  );
}
