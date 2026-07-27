"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatoBadge } from "@/components/dashboard/stato-badge";
import { articoliMock } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";
import type { StatoArticolo } from "@/types";

const FILTRI: { value: StatoArticolo | "tutti"; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "acquistato", label: "Acquistati" },
  { value: "in vendita", label: "In vendita" },
  { value: "venduto", label: "Venduti" },
  { value: "consegnato", label: "Consegnati" },
];

export default function ArticoliPage() {
  const [filtro, setFiltro] = useState<StatoArticolo | "tutti">("tutti");
  const [ricerca, setRicerca] = useState("");

  // TODO: con i dati live (Supabase) spostare filtro/sort/paginazione lato DB
  // (query con order/ilike/range) invece di caricare tutto e filtrare in client.
  const articoli = useMemo(() => {
    return [...articoliMock]
      .sort((a, b) => b.dataAcquisto.localeCompare(a.dataAcquisto))
      .filter((a) => (filtro === "tutti" ? true : a.stato === filtro))
      .filter((a) => a.prodottoNome.toLowerCase().includes(ricerca.toLowerCase()));
  }, [filtro, ricerca]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as StatoArticolo | "tutti")}>
          <TabsList>
            {FILTRI.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="ricerca-articoli" className="sr-only">
            Cerca prodotto
          </label>
          <Input
            id="ricerca-articoli"
            placeholder="Cerca prodotto…"
            className="pl-8"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prodotto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Data acquisto</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data vendita</TableHead>
                <TableHead className="text-right">Prezzo vendita</TableHead>
                <TableHead>Piattaforma</TableHead>
                <TableHead className="text-right">Profitto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articoli.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.prodottoNome}</TableCell>
                  <TableCell className="text-muted-foreground">{a.categoria}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.dataAcquisto)}</TableCell>
                  <TableCell className="text-right font-mono-num">
                    {formatCurrency(a.costoAcquisto)}
                  </TableCell>
                  <TableCell>
                    <StatoBadge stato={a.stato} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.dataVendita ? formatDate(a.dataVendita) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono-num">
                    {a.prezzoVendita != null ? formatCurrency(a.prezzoVendita) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.piattaformaVendita ?? "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono-num ${
                      a.profitto != null ? (a.profitto >= 0 ? "text-positive" : "text-negative") : ""
                    }`}
                  >
                    {a.profitto != null ? formatCurrency(a.profitto) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {articoli.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Nessun articolo trovato.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
