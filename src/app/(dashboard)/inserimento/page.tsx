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

export default function InserimentoPage() {
  const [prodottoId, setProdottoId] = useState("");
  const [dataAcquisto, setDataAcquisto] = useState("");
  const [costoAcquisto, setCostoAcquisto] = useState("");
  const [fonte, setFonte] = useState<FonteAcquisto | "">("");
  const [note, setNote] = useState("");

  const prodottoSelezionato = prodottiMock.find((p) => p.id === prodottoId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prodottoId || !dataAcquisto || !costoAcquisto || !fonte) {
      toast.error("Compila i campi obbligatori.");
      return;
    }
    toast.success("Articolo registrato", {
      description: `${prodottoSelezionato?.nome} · ${costoAcquisto}€ da ${fonte}. (Demo: dato non persistito, connettere Supabase.)`,
    });
    setProdottoId("");
    setDataAcquisto("");
    setCostoAcquisto("");
    setFonte("");
    setNote("");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <PackagePlus className="size-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-display text-lg italic text-foreground">Nuovo acquisto</h2>
            <p className="text-xs text-muted-foreground">
              Registra un nuovo articolo appena acquistato.
            </p>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prodotto">Prodotto *</Label>
            <Select value={prodottoId} onValueChange={(v) => setProdottoId(v ?? "")}>
              <SelectTrigger id="prodotto" className="w-full">
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
              />
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
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fonte">Fonte acquisto *</Label>
            <Select value={fonte} onValueChange={(v) => setFonte((v as FonteAcquisto) ?? "")}>
              <SelectTrigger id="fonte" className="w-full">
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
