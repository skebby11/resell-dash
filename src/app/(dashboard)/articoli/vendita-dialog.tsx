"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { BadgeEuro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import {
  DESTINAZIONI,
  PIATTAFORME_VENDITA,
  SPEDIZIONIERI,
  type Articolo,
} from "@/types";
import { registraVendita, type StatoVendita } from "./actions";

function BottoneSalva({ modifica }: { modifica: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <BadgeEuro className="size-4" />
      {pending ? "Salvataggio…" : modifica ? "Aggiorna vendita" : "Registra vendita"}
    </Button>
  );
}

/** Valore per un `<input type="number">`: la virgola non è accettata dal browser. */
function numInput(v: number | null): string {
  return v == null ? "" : String(v);
}

function CampiVendita({
  articolo,
  campi,
}: {
  articolo: Articolo;
  campi: StatoVendita["campi"];
}) {
  const [prezzo, setPrezzo] = useState(numInput(articolo.prezzoVendita));
  const [fee, setFee] = useState(numInput(articolo.fee));
  const [stato, setStato] = useState<string>(
    articolo.stato === "consegnato" ? "consegnato" : "venduto"
  );
  const [destinazione, setDestinazione] = useState(articolo.destinazione ?? "");

  // Il foglio di calcolo ragionava in percentuale ("eBay 5%"), il database
  // memorizza un importo. Mostrare la percentuale implicita evita di dover
  // rifare il conto a mente per capire se la cifra inserita è plausibile.
  const prezzoNum = Number(prezzo.replace(",", "."));
  const feeNum = Number(fee.replace(",", "."));
  const feePct =
    Number.isFinite(prezzoNum) && prezzoNum > 0 && Number.isFinite(feeNum) && feeNum > 0
      ? (feeNum / prezzoNum) * 100
      : null;

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="id" value={articolo.id} />
      <input type="hidden" name="stato" value={stato} />
      <input type="hidden" name="destinazione" value={destinazione} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-data">Data vendita *</Label>
          <Input
            id="v-data"
            name="data_vendita"
            type="date"
            defaultValue={articolo.dataVendita ?? ""}
            aria-invalid={Boolean(campi?.data_vendita)}
          />
          {campi?.data_vendita && (
            <p className="text-xs text-destructive">{campi.data_vendita}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-prezzo">Prezzo vendita (€) *</Label>
          <Input
            id="v-prezzo"
            name="prezzo_vendita"
            type="number"
            min="0"
            step="0.01"
            value={prezzo}
            onChange={(e) => setPrezzo(e.target.value)}
            aria-invalid={Boolean(campi?.prezzo_vendita)}
          />
          {campi?.prezzo_vendita && (
            <p className="text-xs text-destructive">{campi.prezzo_vendita}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-fee">Fee (€)</Label>
          <Input
            id="v-fee"
            name="fee"
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            aria-invalid={Boolean(campi?.fee)}
          />
          {campi?.fee ? (
            <p className="text-xs text-destructive">{campi.fee}</p>
          ) : (
            feePct != null && (
              <p className="text-xs text-muted-foreground">
                {feePct.toLocaleString("it-IT", { maximumFractionDigits: 2 })}% del prezzo
              </p>
            )
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-spedizione">Costo spedizione (€)</Label>
          <Input
            id="v-spedizione"
            name="costo_spedizione"
            type="number"
            min="0"
            step="0.01"
            defaultValue={numInput(articolo.costoSpedizione)}
            aria-invalid={Boolean(campi?.costo_spedizione)}
          />
          {campi?.costo_spedizione && (
            <p className="text-xs text-destructive">{campi.costo_spedizione}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Piattaforma e spedizioniere usano una datalist e non una select:
            i valori noti sono suggerimenti, ma nello storico ne compaiono altri
            e un canale nuovo non deve richiedere una modifica al codice. */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-piattaforma">Piattaforma</Label>
          <Input
            id="v-piattaforma"
            name="piattaforma_vendita"
            list="lista-piattaforme"
            defaultValue={articolo.piattaformaVendita ?? ""}
            placeholder="eBay, Vinted…"
          />
          <datalist id="lista-piattaforme">
            {PIATTAFORME_VENDITA.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-spedizioniere">Spedizioniere</Label>
          <Input
            id="v-spedizioniere"
            name="spedizioniere"
            list="lista-spedizionieri"
            defaultValue={articolo.spedizioniere ?? ""}
            placeholder="BRT, InPost…"
          />
          <datalist id="lista-spedizionieri">
            {SPEDIZIONIERI.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-destinazione">Destinazione</Label>
          <Select value={destinazione} onValueChange={(v) => setDestinazione(v ?? "")}>
            <SelectTrigger id="v-destinazione" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {DESTINAZIONI.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-stato">Stato</Label>
          <Select value={stato} onValueChange={(v) => setStato(v ?? "venduto")}>
            <SelectTrigger id="v-stato" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venduto">Venduto</SelectItem>
              <SelectItem value="consegnato">Consegnato</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-2.5">
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox name="prodotto_sponsorizzato" defaultChecked={articolo.prodottoSponsorizzato} />
          Prodotto sponsorizzato
        </Label>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox name="vendita_post_offerta" defaultChecked={articolo.venditaPostOfferta} />
          Vendita post offerta
        </Label>
      </div>

      <p className="rounded-md bg-secondary px-2.5 py-2 text-xs text-muted-foreground">
        Costo d&apos;acquisto: <span className="font-mono-num">{formatCurrency(articolo.costoAcquisto)}</span>.
        Il profitto lo calcola il database come prezzo − costo − spedizione − fee.
      </p>
    </div>
  );
}

export function VenditaDialog({ articolo }: { articolo: Articolo }) {
  const [stato, action] = useActionState<StatoVendita, FormData>(registraVendita, { seq: 0 });
  const modifica = articolo.stato === "venduto" || articolo.stato === "consegnato";

  useEffect(() => {
    if (stato.seq > 0) toast.success(modifica ? "Vendita aggiornata" : "Vendita registrata");
  }, [stato.seq, modifica]);

  useEffect(() => {
    if (stato.errore) toast.error(stato.errore);
  }, [stato.errore]);

  return (
    // `key` sul Dialog: a salvataggio riuscito il componente si rimonta e torna
    // chiuso. Chiuderlo con setState dentro un effect innescherebbe render a
    // cascata (regola lint react-hooks/set-state-in-effect).
    <Dialog key={stato.seq}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" />}>
        {modifica ? "Modifica" : "Vendi"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modifica ? "Modifica vendita" : "Registra vendita"}</DialogTitle>
          <DialogDescription>{articolo.prodottoNome}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <CampiVendita articolo={articolo} campi={stato.campi} />
          <DialogFooter>
            <BottoneSalva modifica={modifica} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
