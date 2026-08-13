"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { caricaVenditeMese } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Periodo } from "@/lib/data/periodo";
import type { Articolo, VenditaMensile } from "@/types";

type PaginaVendite = {
  righe: Articolo[];
  totale: number;
  pagina: number;
  perPagina: number;
};

/**
 * Dialog delle vendite di un mese. I totali in footer sono quelli già
 * ritagliati della riga (`VenditaMensile`), non la somma della pagina
 * corrente: così restano allineati alla tabella anche oltre 50 vendite.
 *
 * Paginazione a bottoni, non `Paginazione`: quella vive sull'URL e
 * navigherebbe via dalla dashboard.
 */
export function DettaglioMese({
  mese,
  periodo,
}: {
  mese: VenditaMensile;
  periodo: Periodo;
}) {
  const [inCorso, startTransition] = useTransition();
  const [pagina, setPagina] = useState<PaginaVendite | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  function carica(p: number) {
    startTransition(async () => {
      try {
        const res = await caricaVenditeMese(mese.mese, periodo.da, periodo.a, p);
        setPagina(res);
        setErrore(null);
      } catch (e) {
        setErrore(e instanceof Error ? e.message : "Caricamento non riuscito.");
      }
    });
  }

  function onOpenChange(aperto: boolean) {
    if (aperto) {
      setPagina(null);
      setErrore(null);
      carica(1);
    }
  }

  const ultima = pagina ? Math.max(1, Math.ceil(pagina.totale / pagina.perPagina)) : 1;
  const da =
    pagina && pagina.totale > 0 ? (pagina.pagina - 1) * pagina.perPagina + 1 : 0;
  const a = pagina ? Math.min(pagina.pagina * pagina.perPagina, pagina.totale) : 0;

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            aria-label={`Dettaglio ${mese.meseLabel}`}
          />
        }
      >
        Dettaglio
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mese.meseLabel}</DialogTitle>
          <DialogDescription>
            Articoli venduti o consegnati in questo mese
            {periodo.da || periodo.a ? ", ritagliati al periodo della dashboard" : ""}.
          </DialogDescription>
        </DialogHeader>

        {errore && (
          <p className="text-sm text-destructive" role="alert">
            {errore}
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prodotto</TableHead>
              <TableHead>Data vendita</TableHead>
              <TableHead className="text-right">Prezzo</TableHead>
              <TableHead>Piattaforma</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Spedizione</TableHead>
              <TableHead className="text-right">Profitto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!pagina ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {errore ? "—" : "Caricamento…"}
                </TableCell>
              </TableRow>
            ) : pagina.righe.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nessuna vendita in questo intervallo.
                </TableCell>
              </TableRow>
            ) : (
              pagina.righe.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.prodottoNome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.dataVendita ? formatDate(r.dataVendita) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono-num">
                    {r.prezzoVendita != null ? formatCurrency(r.prezzoVendita) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.piattaformaVendita ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono-num">
                    {formatCurrency(r.fee ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono-num">
                    {formatCurrency(r.costoSpedizione ?? 0)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono-num ${
                      r.profitto != null
                        ? r.profitto >= 0
                          ? "text-positive"
                          : "text-negative"
                        : ""
                    }`}
                  >
                    {r.profitto != null ? formatCurrency(r.profitto) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">
                Totale
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({formatNumber(mese.numeroVendite)})
                </span>
              </TableCell>
              <TableCell />
              <TableCell className="text-right font-mono-num">
                {formatCurrency(mese.totaleVendite)}
              </TableCell>
              <TableCell />
              <TableCell className="text-right font-mono-num">
                {formatCurrency(mese.feeTotali)}
              </TableCell>
              <TableCell className="text-right font-mono-num">
                {formatCurrency(mese.spedizioneTotale)}
              </TableCell>
              <TableCell
                className={`text-right font-mono-num ${
                  mese.profitto >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatCurrency(mese.profitto)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {pagina && pagina.totale > pagina.perPagina && (
          <nav
            className="flex flex-col items-center justify-between gap-3 sm:flex-row"
            aria-label="Paginazione vendite del mese"
          >
            <p className="text-xs text-muted-foreground" aria-live="polite">
              <span className="font-mono-num">
                {formatNumber(da)}–{formatNumber(a)}
              </span>{" "}
              di <span className="font-mono-num">{formatNumber(pagina.totale)}</span> vendite
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={inCorso || pagina.pagina <= 1}
                onClick={() => carica(pagina.pagina - 1)}
              >
                <ChevronLeft className="size-4" />
                Precedente
              </Button>
              <span className="px-1 text-xs text-muted-foreground">
                <span className="font-mono-num">{pagina.pagina}</span> /{" "}
                <span className="font-mono-num">{ultima}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={inCorso || pagina.pagina >= ultima}
                onClick={() => carica(pagina.pagina + 1)}
              >
                Successiva
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </nav>
        )}
      </DialogContent>
    </Dialog>
  );
}
