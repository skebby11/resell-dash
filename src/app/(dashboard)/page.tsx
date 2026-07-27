import { Archive, PiggyBank, ShoppingBag, Tag, TrendingUp, Wallet } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { VenditeMensiliChart } from "@/components/dashboard/charts/vendite-mensili-chart";
import { DistribuzioneDonut } from "@/components/dashboard/charts/distribuzione-donut";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  kpi,
  venditePerCategoria,
  venditePerDestinazione,
  venditePerFonte,
  venditePerMese,
  venditePerPiattaforma,
} from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const mensili = venditePerMese();

  return (
    <div className="flex flex-col gap-6">
      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="N° Vendite" value={String(kpi.numeroVendite)} icon={ShoppingBag} hint="ultimi 6 mesi" />
        <KpiCard
          label="Prezzo Medio Vendita"
          value={formatCurrency(kpi.prezzoMedioVendita)}
          icon={Tag}
        />
        <KpiCard
          label="Vendite Totali"
          value={formatCurrency(kpi.venditeTotali)}
          icon={Wallet}
        />
        <KpiCard
          label="Profitto Totale"
          value={formatCurrency(kpi.profittoTotale)}
          icon={TrendingUp}
          tone="positive"
        />
        <KpiCard
          label="Fondi Immobilizzati"
          value={formatCurrency(kpi.fondiImmobilizzati)}
          icon={Archive}
          hint="scorta non ancora venduta"
        />
        <KpiCard label="Capitale" value={formatCurrency(kpi.capitale)} icon={PiggyBank} />
      </section>

      {/* Vendite per mese */}
      <ChartCard
        title="Vendite per mese"
        description="Numero di vendite (barre) e totale incassato (linea)"
      >
        <VenditeMensiliChart data={mensili} />
      </ChartCard>

      {/* Donuts */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Per categoria" description="Ripartizione vendite">
          <DistribuzioneDonut data={venditePerCategoria()} />
        </ChartCard>
        <ChartCard title="Per piattaforma" description="Dove viene venduto">
          <DistribuzioneDonut data={venditePerPiattaforma()} />
        </ChartCard>
        <ChartCard title="Per fonte d'acquisto" description="Da dove arriva la merce">
          <DistribuzioneDonut data={venditePerFonte()} />
        </ChartCard>
        <ChartCard title="Per destinazione" description="Italia vs estero">
          <DistribuzioneDonut data={venditePerDestinazione()} />
        </ChartCard>
      </section>

      {/* Tabella vendite per mese */}
      <ChartCard title="Dettaglio vendite per mese" className="pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mese</TableHead>
              <TableHead className="text-right">Numero vendite</TableHead>
              <TableHead className="text-right">Prezzo medio</TableHead>
              <TableHead className="text-right">Totale vendite</TableHead>
              <TableHead className="text-right">Profitto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mensili.map((m) => (
              <TableRow key={m.mese}>
                <TableCell className="font-medium">{m.meseLabel}</TableCell>
                <TableCell className="text-right font-mono-num">{m.numeroVendite}</TableCell>
                <TableCell className="text-right font-mono-num">
                  {formatCurrency(m.prezzoMedio)}
                </TableCell>
                <TableCell className="text-right font-mono-num">
                  {formatCurrency(m.totaleVendite)}
                </TableCell>
                <TableCell className="text-right font-mono-num text-positive">
                  {formatCurrency(m.profitto)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  );
}
