import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleHelp } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatoVuoto } from "@/components/dashboard/stato-vuoto";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVenditePerPaeseAnno } from "@/lib/data/queries";
import { formatCurrency, formatNumber } from "@/lib/format";
import { nomePaese } from "@/types";

// Un valore singolo se minimo e massimo coincidono (nessuna lacuna, o lacuna
// che non lascia comunque incertezza sul totale), un intervallo altrimenti.
// Usata per non mostrare mai "€ 100,00 – € 100,00": sarebbe rumore, non
// informazione, quando il numero è già certo al centesimo.
function formatoIntervallo(
  minimo: number,
  massimo: number,
  formatta: (v: number) => string,
): string {
  return minimo === massimo ? formatta(minimo) : `${formatta(minimo)} – ${formatta(massimo)}`;
}

export default async function VenditeUePage() {
  const anni = await getVenditePerPaeseAnno();

  if (anni.length === 0) {
    return (
      <StatoVuoto
        titolo="Ancora nessuna vendita"
        descrizione="Questa pagina si popola al primo articolo segnato come venduto, riepilogato per paese e anno solare."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Vendite per paese UE e anno solare, su venduto/consegnato. Non risente del filtro periodo
        della dashboard: è per definizione uno storico per anno solare. Per l&apos;interpretazione
        (quale totale rilevi per il tuo caso) rivolgiti al tuo consulente — qui trovi solo i numeri.
      </p>

      {anni.map((anno) => {
        const totaleAnno =
          anno.righe.reduce((s, r) => s + r.totaleVendite, 0) +
          anno.senzaPaeseEstero.totaleVendite +
          anno.senzaPaeseIgnota.totaleVendite;
        const { minimo, massimo, incompleto } = anno.totaleFuoriItalia;

        return (
          <ChartCard key={anno.anno} title={String(anno.anno)}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paese</TableHead>
                    <TableHead className="text-right">N. vendite</TableHead>
                    <TableHead className="text-right">Totale vendite</TableHead>
                    <TableHead className="text-right">Profitto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anno.righe.map((r) => (
                    <TableRow key={r.paese}>
                      <TableCell className="font-medium">{nomePaese(r.paese as string)}</TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatNumber(r.numeroVendite)}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatCurrency(r.totaleVendite)}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatCurrency(r.profittoTotale)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Vendite certamente estere ma senza paese assegnato
                      (destinazione = 'Estero', paese_vendita NULL): manca solo
                      quale dei 27, non se sia stata una vendita fuori Italia.
                      Riga propria, mai sommata dentro "Estero senza paese"
                      genericamente: il proprietario deve poter distinguere
                      "so che è estero, non so quale paese" da "non so nemmeno
                      quello" (riga successiva). */}
                  {anno.senzaPaeseEstero.numeroVendite > 0 && (
                    <TableRow className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5" />
                          Estero, paese non assegnato
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatNumber(anno.senzaPaeseEstero.numeroVendite)}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatCurrency(anno.senzaPaeseEstero.totaleVendite)}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatCurrency(anno.senzaPaeseEstero.profittoTotale)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Vendite con destinazione ignota: qui l'incertezza è più
                      profonda della riga sopra, non si sa nemmeno se la
                      vendita sia italiana o estera. Stile deliberatamente
                      diverso (non ambra) per non farla leggere come "la
                      stessa lacuna" della riga precedente. */}
                  {anno.senzaPaeseIgnota.numeroVendite > 0 && (
                    <TableRow className="bg-muted/60 text-muted-foreground">
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <CircleHelp className="size-3.5" />
                          Destinazione sconosciuta
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatNumber(anno.senzaPaeseIgnota.numeroVendite)}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatCurrency(anno.senzaPaeseIgnota.totaleVendite)}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatCurrency(anno.senzaPaeseIgnota.profittoTotale)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Totale UE (esclusa Italia). Quando non c'è alcuna vendita
                      senza paese, è un numero unico come prima: la lacuna non
                      esiste, l'avviso non deve comparire. Quando la lacuna
                      c'è, NON può restare un numero secco (è così che si legge
                      "0,00 € = niente venduto all'estero" mentre in realtà
                      manca solo l'attribuzione): diventa un intervallo
                      minimo certo – massimo possibile, con etichetta e stile
                      che rendono impossibile scambiarlo per un totale finale. */}
                  <TableRow
                    className={
                      incompleto
                        ? "border-t-2 border-amber-500/50 bg-amber-500/15 font-medium text-amber-800 dark:text-amber-300"
                        : "border-t-2 border-border bg-secondary/50 font-medium"
                    }
                  >
                    <TableCell>
                      {incompleto ? (
                        <span className="inline-flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5" />
                          Totale fuori Italia — PARZIALE
                        </span>
                      ) : (
                        "Totale UE (esclusa Italia)"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono-num">
                      {incompleto
                        ? formatoIntervallo(minimo.numeroVendite, massimo.numeroVendite, formatNumber)
                        : formatNumber(anno.totaleUeEsclusaItalia.numeroVendite)}
                    </TableCell>
                    <TableCell className="text-right font-mono-num">
                      {incompleto
                        ? formatoIntervallo(minimo.totaleVendite, massimo.totaleVendite, formatCurrency)
                        : formatCurrency(anno.totaleUeEsclusaItalia.totaleVendite)}
                    </TableCell>
                    <TableCell className="text-right font-mono-num">
                      {incompleto
                        ? formatoIntervallo(minimo.profittoTotale, massimo.profittoTotale, formatCurrency)
                        : formatCurrency(anno.totaleUeEsclusaItalia.profittoTotale)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {incompleto && (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                Intervallo, non stima: <strong>minimo certo</strong> = paesi noti sopra + vendite
                &quot;Estero, paese non assegnato&quot; (sono comunque estere, solo il paese manca).{" "}
                <strong>Massimo possibile</strong> = minimo + vendite a destinazione sconosciuta
                (potrebbero essere italiane o estere).
              </p>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Totale anno (tutti i paesi + senza paese): {formatCurrency(totaleAnno)}
            </p>

            {incompleto && (
              <Link
                href="/articoli?paese=mancante"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Correggi le {formatNumber(anno.senzaPaeseEstero.numeroVendite + anno.senzaPaeseIgnota.numeroVendite)}{" "}
                vendite senza paese ({formatNumber(anno.senzaPaeseEstero.numeroVendite)} sicuramente
                estere, {formatNumber(anno.senzaPaeseIgnota.numeroVendite)} di destinazione ignota)
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </ChartCard>
        );
      })}
    </div>
  );
}
