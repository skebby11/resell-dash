"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatoBadge } from "@/components/dashboard/stato-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { nomePaese, type Articolo } from "@/types";
import { AzioniStato } from "./azioni-stato";
import { VenditaDialog } from "./vendita-dialog";

const VENDUTO_STATI = new Set(["venduto", "consegnato"]);

/** Testo della colonna Paese: distingue "non ancora venduto" da "venduto ma senza paese noto". */
function testoPaese(a: Articolo): { testo: string; lacuna: boolean } {
  if (!VENDUTO_STATI.has(a.stato)) return { testo: "—", lacuna: false };
  if (a.paeseVendita) return { testo: nomePaese(a.paeseVendita), lacuna: false };
  return { testo: a.destinazione === "Estero" ? "Estero (?)" : "?", lacuna: true };
}

/**
 * Tabella della pagina corrente. Riceve righe già filtrate e paginate dal
 * database: qui non si filtra e non si ordina nulla.
 *
 * È un componente client solo perché le azioni per riga (dialog di vendita,
 * cambi di stato) hanno bisogno di interattività.
 */
export function ArticoliTable({ articoli }: { articoli: Articolo[] }) {
  return (
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
              <TableHead>Paese</TableHead>
              <TableHead className="text-right">Profitto</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articoli.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {a.prodottoNome}
                  {a.note && (
                    <span
                      className="ml-1.5 cursor-help text-muted-foreground"
                      title={a.note}
                      aria-label={`Note: ${a.note}`}
                    >
                      *
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{a.categoria ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(a.dataAcquisto)}
                </TableCell>
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
                  className={
                    testoPaese(a).lacuna ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }
                >
                  {testoPaese(a).testo}
                </TableCell>
                <TableCell
                  className={`text-right font-mono-num ${
                    a.profitto != null ? (a.profitto >= 0 ? "text-positive" : "text-negative") : ""
                  }`}
                >
                  {a.profitto != null ? formatCurrency(a.profitto) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <VenditaDialog articolo={a} />
                    <AzioniStato articolo={a} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {articoli.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  Nessun articolo corrisponde ai filtri.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
