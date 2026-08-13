"use server";

import { intervalloMeseNelPeriodo } from "@/lib/data/periodo";
import { getArticoliPaginati } from "@/lib/data/queries";

/**
 * Vendite di un mese di calendario, ritagliate al periodo della dashboard
 * (`?da=&a=`). Il ritaglio sta qui così il dialog non ricostruisce le date
 * e i bordi restano quelli già usati per i totali della riga.
 */
export async function caricaVenditeMese(
  mese: string,
  daPeriodo?: string,
  aPeriodo?: string,
  pagina = 1
) {
  const clip = intervalloMeseNelPeriodo(mese, { da: daPeriodo, a: aPeriodo });
  return getArticoliPaginati({
    daVendita: clip.da,
    aVendita: clip.a,
    pagina,
  });
}
