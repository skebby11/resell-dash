"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { prodottiMock } from "@/lib/mock-data";
import type { FonteAcquisto } from "@/types";

const FONTI: FonteAcquisto[] = ["Vinted", "Altro", "Amici/Parenti", "eBay"];

interface FormErrors {
  prodotto?: string;
  data?: string;
  costo?: string;
  fonte?: string;
}

export default function InserimentoPage() {
  const [prodottoId, setProdottoId] = useState("");
  const [dataAcquisto, setDataAcquisto] = useState("");
  const [costoAcquisto, setCostoAcquisto] = useState("");
  const [fonte, setFonte] = useState<FonteAcquisto | "">("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const prodottoSelezionato = prodottiMock.find((p) => p.id === prodottoId);

  // TODO(backend): sostituire questa validazione + toast con una server action che valida
  // (stesso schema, lato server) e persiste su Supabase quando l'integrazione è collegata.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    if (!prodottoId.trim()) nextErrors.prodotto = "Seleziona un prodotto.";
    if (!dataAcquisto.trim()) nextErrors.data = "Indica la data di acquisto.";

    const costoNumerico = Number(costoAcquisto);
    if (!costoAcquisto.trim()) {
      nextErrors.costo = "Indica il costo di acquisto.";
    } else if (!Number.isFinite(costoNumerico) || costoNumerico < 0) {
      nextErrors.costo = "Il costo deve essere un numero valido e non negativo.";
    }

    if (!fonte) nextErrors.fonte = "Indica la fonte di acquisto.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Compila correttamente i campi obbligatori.");
      return;
    }

    toast.success("Articolo registrato (demo)", {
      description: `${prodottoSelezionato?.nome} · ${costoNumerico}€ da ${fonte}${
        note.trim() ? ` · Note: ${note.trim()}` : ""
      }. Dato non persistito: connettere Supabase.`,
    });
    setProdottoId("");
    setDataAcquisto("");
    setCostoAcquisto("");
    setFonte("");
    setNote("");
    setErrors({});
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PackagePlus className="size-4" strokeWidth={2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg italic text-foreground">Nuovo acquisto</h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Anteprima / demo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Registra un nuovo articolo appena acquistato. Il salvataggio è simulato: i dati non
              vengono persistiti finché non è collegata l&apos;integrazione Supabase.
            </p>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prodotto">Prodotto *</Label>
            <Select value={prodottoId} onValueChange={(v) => setProdottoId(v ?? "")}>
              <SelectTrigger id="prodotto" className="w-full" aria-invalid={Boolean(errors.prodotto)}>
                <SelectValue placeholder="Seleziona dal catalogo…" />
              </SelectTrigger>
              <SelectContent>
                {prodottiMock.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} · {p.categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.prodotto && <p className="text-xs text-destructive">{errors.prodotto}</p>}
            {prodottoSelezionato && (
              <p className="text-xs text-muted-foreground">
                Prezzo medio acquisto storico: {prodottoSelezionato.prezzoMedioAcquisto}€
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data">Data acquisto *</Label>
              <Input
                id="data"
                type="date"
                value={dataAcquisto}
                onChange={(e) => setDataAcquisto(e.target.value)}
                aria-invalid={Boolean(errors.data)}
              />
              {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costo">Costo acquisto (€) *</Label>
              <Input
                id="costo"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={costoAcquisto}
                onChange={(e) => setCostoAcquisto(e.target.value)}
                aria-invalid={Boolean(errors.costo)}
              />
              {errors.costo && <p className="text-xs text-destructive">{errors.costo}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fonte">Fonte acquisto *</Label>
            <Select value={fonte} onValueChange={(v) => setFonte((v as FonteAcquisto) ?? "")}>
              <SelectTrigger id="fonte" className="w-full" aria-invalid={Boolean(errors.fonte)}>
                <SelectValue placeholder="Da dove arriva?" />
              </SelectTrigger>
              <SelectContent>
                {FONTI.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.fonte && <p className="text-xs text-destructive">{errors.fonte}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Stato estetico, accessori inclusi, difetti…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <Button type="submit" className="mt-2 self-start">
            <PackagePlus className="size-4" />
            Registra articolo
          </Button>
        </form>
      </div>
    </div>
  );
}
