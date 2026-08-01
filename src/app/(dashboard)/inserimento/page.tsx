import { PackagePlus } from "lucide-react";
import { getNomiProdotti } from "@/lib/data/queries";
import { InserimentoForm } from "./inserimento-form";

export default async function InserimentoPage() {
  // Solo nome e prezzo medio: servono a popolare l'autocompletamento, non
  // l'intera anagrafica.
  const prodotti = await getNomiProdotti();

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
              Registra un articolo appena acquistato. Entra in magazzino con stato «acquistato»;
              la vendita si registra poi dalla pagina Articoli.
            </p>
          </div>
        </div>

        <InserimentoForm prodotti={prodotti} />
      </div>
    </div>
  );
}
