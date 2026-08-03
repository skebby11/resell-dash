"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Camera, PackagePlus, ScanBarcode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { CATEGORIE, PIATTAFORME_GIOCO, FONTI_ACQUISTO } from "@/types";
import { creaArticolo, type StatoInserimento } from "./actions";

export interface ProdottoNoto {
  nome: string;
  prezzoMedioAcquisto: number | null;
}

// `BarcodeDetector` non è ancora nei tipi DOM standard di TypeScript: la
// dichiarazione locale evita `any` mantenendo il controllo dei tipi sul poco
// che usiamo (detect). Presente solo su Chrome/Safari recenti, da qui la
// feature detection (`"BarcodeDetector" in window`) invece di assumerne l'uso.
interface RisultatoBarcodeDetector {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<RisultatoBarcodeDetector[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opzioni: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/** Forma della risposta di GET /api/barcode (vedi src/lib/integrations/lookup.ts). */
interface RispostaLookupBarcode {
  barcode: string;
  prodottoEsistente: {
    nome: string;
    categoria: string | null;
    piattaformaGioco?: string | null;
    fotoUrl?: string | null;
    prezzoMedioAcquisto?: number | null;
    prezzoMedioVendita?: number | null;
  } | null;
}

/** Un candidato IGDB fra cui scegliere (vedi src/lib/integrations/igdb.ts). */
interface CandidatoIgdb {
  id: number;
  nome: string;
  piattaforme: string[];
  anno: number | null;
  copertina?: string;
}

/** Forma della risposta di GET /api/igdb. */
interface RispostaRicercaIgdb {
  configurato: boolean;
  risultati: CandidatoIgdb[];
  messaggioErrore?: string;
}

/** Etichetta visibile accanto a un campo precompilato da IGDB, ancora da verificare. */
function BadgeDaConfermare() {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      Da confermare · IGDB
    </Badge>
  );
}

/**
 * Campi che la scelta di un candidato IGDB può precompilare (non il catalogo
 * interno, che è già dato autorevole). L'utente deve vedere chiaramente quali
 * valori sono ancora "suggerimenti da verificare": un campo precompilato male
 * e accettato senza guardare è peggio di un campo vuoto, soprattutto per
 * `categoria` che alimenta le statistiche.
 */
type CampoSuggerito = "nome" | "categoria" | "piattaforma";
type SuggerimentiAttivi = Partial<Record<CampoSuggerito, true>>;

function BottoneSalva() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-2 self-start" disabled={pending}>
      <PackagePlus className="size-4" />
      {pending ? "Salvataggio…" : "Registra articolo"}
    </Button>
  );
}

// Il supporto di `BarcodeDetector` non cambia mentre la pagina è aperta:
// nessun evento a cui iscriversi, da qui la subscribe no-op. `useSyncExternalStore`
// (non state+effect) evita sia il mismatch di idratazione — il server non ha
// `window` e deve rendere "non supportato" — sia il lint
// react-hooks/set-state-in-effect di uno `setState` sincrono nell'effect.
function sottoscriviSupportoInvariato() {
  return () => {};
}
function leggiSupportoBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}
function leggiSupportoBarcodeDetectorServer(): boolean {
  return false;
}

/**
 * Overlay di scansione con l'API nativa `BarcodeDetector` (Chrome/Safari
 * recenti, nessuna dipendenza). Feature detection, non user-agent sniffing:
 * il pulsante semplicemente non compare dove l'API manca, degradando
 * all'inserimento manuale del codice.
 */
function ScansioneBarcode({ onRilevato }: { onRilevato: (codice: string) => void }) {
  const [attiva, setAttiva] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const supportata = useSyncExternalStore(
    sottoscriviSupportoInvariato,
    leggiSupportoBarcodeDetector,
    leggiSupportoBarcodeDetectorServer
  );

  useEffect(() => {
    if (!attiva) return;
    let annullato = false;
    let intervallo: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (annullato) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const Rilevatore = window.BarcodeDetector!;
        const rilevatore = new Rilevatore({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
        });
        intervallo = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codici = await rilevatore.detect(videoRef.current);
            if (codici[0]?.rawValue) {
              onRilevato(codici[0].rawValue);
              setAttiva(false);
            }
          } catch {
            // Frame non leggibile in questo giro: si riprova al successivo.
          }
        }, 400);
      } catch {
        toast.error("Fotocamera non disponibile o permesso negato.");
        setAttiva(false);
      }
    })();

    return () => {
      annullato = true;
      if (intervallo) clearInterval(intervallo);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attiva, onRilevato]);

  if (!supportata) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAttiva(true)}>
        <Camera className="size-4" />
        Scansiona
      </Button>
      {attiva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAttiva(false)}
        >
          <div
            className="relative overflow-hidden rounded-lg bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <video ref={videoRef} className="max-h-[70vh] w-full" muted playsInline />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={() => setAttiva(false)}
            >
              Chiudi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * I campi vivono in un componente separato perché il genitore li rimonta
 * cambiandone la `key` dopo ogni salvataggio riuscito: è così che il form si
 * svuota, senza azzerare stato dentro un effect.
 */
function CampiInserimento({
  prodotti,
  campi,
}: {
  prodotti: ProdottoNoto[];
  campi: StatoInserimento["campi"];
}) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [piattaformaGioco, setPiattaformaGioco] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [cercando, setCercando] = useState(false);
  // Traccia quali campi contengono ancora un suggerimento non verificato
  // (da IGDB). Si svuota per il singolo campo appena l'utente lo modifica:
  // da lì in poi è una scelta sua, non più un suggerimento.
  const [suggeriti, setSuggeriti] = useState<SuggerimentiAttivi>({});
  // Prezzi medi storici del prodotto risolto dal catalogo interno (passo 1
  // del lookup): mai un'inferenza, sempre dato già registrato.
  const [prezziCatalogo, setPrezziCatalogo] = useState<{
    acquisto: number | null;
    vendita: number | null;
  } | null>(null);

  // Passo 2 del lookup: barcode non in catalogo, l'utente cerca il titolo su
  // IGDB e sceglie fra i candidati. Vedi README, sezione Barcode lookup.
  const [mostraRicercaIgdb, setMostraRicercaIgdb] = useState(false);
  const [queryIgdb, setQueryIgdb] = useState("");
  const [cercandoIgdb, setCercandoIgdb] = useState(false);
  const [risultatiIgdb, setRisultatiIgdb] = useState<CandidatoIgdb[]>([]);
  // Piattaforme del candidato IGDB scelto: se il gioco è uscito su più
  // piattaforme, l'utente sceglie qui quella della copia fisica che ha in
  // mano invece di un elenco generico — un barcode è di UNA copia precisa.
  const [piattaformeCandidato, setPiattaformeCandidato] = useState<string[]>([]);

  // Confronto insensibile a maiuscole e spazi, come lato server.
  const chiave = nome.toLowerCase().replace(/\s+/g, " ").trim();
  const noto = chiave ? prodotti.find((p) => p.nome.toLowerCase() === chiave) : undefined;
  const nuovo = Boolean(chiave) && !noto;

  async function cercaBarcode(codice: string) {
    const valore = codice.trim();
    if (!valore) return;
    setBarcode(valore);
    setCercando(true);
    setMostraRicercaIgdb(false);
    setRisultatiIgdb([]);
    try {
      const res = await fetch(`/api/barcode?barcode=${encodeURIComponent(valore)}`);
      const dati = await res.json();
      if (!res.ok) {
        toast.error(dati?.errore ?? "Ricerca non riuscita.");
        return;
      }
      const risultato = dati as RispostaLookupBarcode;
      const p = risultato.prodottoEsistente;

      if (p) {
        // Dato di catalogo già registrato: mai un'inferenza, niente da verificare.
        setNome(p.nome);
        setCategoria(p.categoria ?? "");
        setPiattaformaGioco(p.piattaformaGioco ?? "");
        setFotoUrl(p.fotoUrl ?? null);
        setSuggeriti({});
        setPrezziCatalogo({ acquisto: p.prezzoMedioAcquisto ?? null, vendita: p.prezzoMedioVendita ?? null });
        const medie = [
          p.prezzoMedioAcquisto != null ? `acquisto medio ${formatCurrency(p.prezzoMedioAcquisto)}` : null,
          p.prezzoMedioVendita != null ? `vendita media ${formatCurrency(p.prezzoMedioVendita)}` : null,
        ].filter(Boolean);
        toast.info(
          medie.length
            ? `Già trattato: ${p.nome} (${medie.join(", ")}). Verrà riusato invece di crearne uno nuovo.`
            : `Già trattato: ${p.nome}. Verrà riusato invece di crearne uno nuovo.`
        );
      } else {
        // Barcode mai visto: tocca all'utente cercare il titolo su IGDB e
        // scegliere, così questo codice viene collegato al salvataggio.
        setPrezziCatalogo(null);
        setMostraRicercaIgdb(true);
        setQueryIgdb((attuale) => attuale || nome);
        toast.info("Barcode non in catalogo: cerca il titolo qui sotto per collegarlo.");
      }
    } catch {
      toast.error("Ricerca non riuscita: rete non raggiungibile.");
    } finally {
      setCercando(false);
    }
  }

  async function cercaSuIgdb() {
    const titolo = queryIgdb.trim();
    if (titolo.length < 2) {
      toast.error("Scrivi almeno due caratteri per cercare.");
      return;
    }
    setCercandoIgdb(true);
    setRisultatiIgdb([]);
    try {
      const res = await fetch(`/api/igdb?q=${encodeURIComponent(titolo)}`);
      const dati = (await res.json()) as RispostaRicercaIgdb | { errore: string };
      if (!res.ok) {
        toast.error("errore" in dati ? dati.errore : "Ricerca IGDB non riuscita.");
        return;
      }
      const risultato = dati as RispostaRicercaIgdb;
      if (!risultato.configurato) {
        toast.warning(risultato.messaggioErrore ?? "IGDB non configurato: compila i campi a mano.");
        return;
      }
      if (risultato.messaggioErrore) toast.warning(risultato.messaggioErrore);
      setRisultatiIgdb(risultato.risultati);
      if (!risultato.risultati.length) toast.info("Nessun risultato IGDB per questo titolo: compila i campi a mano.");
    } catch {
      toast.error("Ricerca IGDB non riuscita: rete non raggiungibile.");
    } finally {
      setCercandoIgdb(false);
    }
  }

  function sceglierCandidatoIgdb(candidato: CandidatoIgdb) {
    setNome(candidato.nome);
    setCategoria("Videogiochi");
    if (candidato.copertina) setFotoUrl(candidato.copertina);
    setPiattaformeCandidato(candidato.piattaforme);
    if (candidato.piattaforme.length === 1) {
      setPiattaformaGioco(candidato.piattaforme[0]);
      setSuggeriti({ nome: true, categoria: true, piattaforma: true });
    } else {
      // Più piattaforme per lo stesso titolo: il barcode è di UNA copia
      // precisa, non indoviniamo. L'utente sceglie dal datalist qui sotto,
      // ora popolato con le sole piattaforme reali di questo gioco.
      setPiattaformaGioco("");
      setSuggeriti({ nome: true, categoria: true });
    }
    setRisultatiIgdb([]);
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="barcode">Codice a barre</Label>
        <div className="flex gap-2">
          <Input
            id="barcode"
            name="barcode"
            inputMode="numeric"
            autoComplete="off"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="EAN-8, UPC-A o EAN-13"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cercando || !barcode.trim()}
            onClick={() => cercaBarcode(barcode)}
          >
            <ScanBarcode className="size-4" />
            {cercando ? "Ricerca…" : "Cerca"}
          </Button>
          <ScansioneBarcode onRilevato={(codice) => cercaBarcode(codice)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Cerca nel catalogo: se questo codice è già stato trattato risolve subito nome,
          categoria, piattaforma, copertina e prezzi medi, senza alcuna chiamata esterna.
        </p>
      </div>

      {mostraRicercaIgdb && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">
              Barcode non in catalogo: cerca il titolo su IGDB
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs text-muted-foreground"
              onClick={() => {
                setMostraRicercaIgdb(false);
                setRisultatiIgdb([]);
              }}
            >
              Nascondi
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              autoComplete="off"
              value={queryIgdb}
              onChange={(e) => setQueryIgdb(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  cercaSuIgdb();
                }
              }}
              placeholder="Es. zelda breath of the wild"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cercandoIgdb || queryIgdb.trim().length < 2}
              onClick={() => cercaSuIgdb()}
            >
              {cercandoIgdb ? "Ricerca…" : "Cerca"}
            </Button>
          </div>
          {risultatiIgdb.length > 0 && (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {risultatiIgdb.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => sceglierCandidatoIgdb(c)}
                    className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-secondary"
                  >
                    {c.copertina ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.copertina} alt="" className="size-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="size-10 shrink-0 rounded bg-secondary" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{c.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.piattaforme.join(", ") || null, c.anno].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Scegliendo un titolo, al salvataggio il barcode verrà collegato a quel prodotto: la
            prossima volta che lo scansioni risolve subito dal catalogo.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="prodotto">Prodotto *</Label>
          {suggeriti.nome && <BadgeDaConfermare />}
        </div>
        {/* Datalist e non select: il catalogo ha centinaia di modelli e capita
            spesso di comprare qualcosa che non c'è ancora. Un nome non in elenco
            crea il prodotto al salvataggio. */}
        <div className="flex items-center gap-2.5">
          {fotoUrl && (
            /* Anteprima client-side prima del salvataggio: l'host non è
               garantito essere uno di quelli autorizzati in next.config.ts,
               dove next/image fallirebbe a runtime. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
          )}
          <Input
            id="prodotto"
            name="prodotto"
            list="lista-prodotti"
            autoComplete="off"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              // L'utente ha preso in mano il campo: non è più un suggerimento da verificare,
              // né le medie mostrate restano garantite per il nuovo testo digitato.
              setSuggeriti((s) => ({ ...s, nome: undefined }));
              setPrezziCatalogo(null);
            }}
            placeholder="Es. zelda botw switch"
            aria-invalid={Boolean(campi?.prodotto)}
            aria-describedby={campi?.prodotto ? "errore-prodotto" : "aiuto-prodotto"}
          />
        </div>
        <datalist id="lista-prodotti">
          {prodotti.map((p) => (
            <option key={p.nome} value={p.nome} />
          ))}
        </datalist>
        {campi?.prodotto ? (
          <p id="errore-prodotto" className="text-xs text-destructive">
            {campi.prodotto}
          </p>
        ) : prezziCatalogo ? (
          // Risolto dal barcode (passo 1 del lookup): dato di catalogo già
          // registrato, non un'inferenza — mostra entrambe le medie storiche
          // quando disponibili, non solo quella d'acquisto.
          <p id="aiuto-prodotto" className="text-xs text-muted-foreground">
            {[
              prezziCatalogo.acquisto != null ? `acquisto medio ${formatCurrency(prezziCatalogo.acquisto)}` : null,
              prezziCatalogo.vendita != null ? `vendita media ${formatCurrency(prezziCatalogo.vendita)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Già in catalogo"}
          </p>
        ) : (
          <p id="aiuto-prodotto" className="text-xs text-muted-foreground">
            {noto
              ? noto.prezzoMedioAcquisto != null
                ? `In catalogo · acquisto medio storico ${formatCurrency(noto.prezzoMedioAcquisto)}`
                : "Già in catalogo"
              : nuovo
                ? "Non in catalogo: verrà creato al salvataggio."
                : `${prodotti.length} modelli in catalogo, oppure scrivine uno nuovo.`}
          </p>
        )}
      </div>

      {/* Categoria e piattaforma servono solo per un prodotto nuovo: per uno
          esistente restano quelle già registrate in anagrafica. */}
      {nuovo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              {suggeriti.categoria && <BadgeDaConfermare />}
            </div>
            <Input
              id="categoria"
              name="categoria"
              list="lista-categorie"
              autoComplete="off"
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setSuggeriti((s) => ({ ...s, categoria: undefined }));
              }}
              placeholder="Videogiochi, Console…"
            />
            <datalist id="lista-categorie">
              {CATEGORIE.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="piattaforma_gioco">Piattaforma</Label>
              {suggeriti.piattaforma && <BadgeDaConfermare />}
            </div>
            <Input
              id="piattaforma_gioco"
              name="piattaforma_gioco"
              list="lista-piattaforme"
              autoComplete="off"
              value={piattaformaGioco}
              onChange={(e) => {
                setPiattaformaGioco(e.target.value);
                setSuggeriti((s) => ({ ...s, piattaforma: undefined }));
              }}
              placeholder="PS5, Switch…"
            />
            {/* Le piattaforme del candidato IGDB scelto vengono prima: sono
                quelle realmente uscite per questo titolo, non un elenco
                generico. Deduplicate rispetto alla lista comune sottostante. */}
            <datalist id="lista-piattaforme">
              {[...piattaformeCandidato, ...PIATTAFORME_GIOCO.filter((p) => !piattaformeCandidato.includes(p))].map(
                (p) => (
                  <option key={p} value={p} />
                )
              )}
            </datalist>
            {piattaformeCandidato.length > 1 && (
              <p className="text-xs text-muted-foreground">
                IGDB conosce più piattaforme per questo titolo: scegli quella della copia che hai in
                mano.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Non c'è un campo visibile per la copertina: arriva solo dal lookup e
          viaggia con il form come valore nascosto. */}
      <input type="hidden" name="foto_url" value={fotoUrl ?? ""} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data">Data acquisto *</Label>
          <Input
            id="data"
            name="data_acquisto"
            type="date"
            aria-invalid={Boolean(campi?.data_acquisto)}
            aria-describedby={campi?.data_acquisto ? "errore-data" : undefined}
          />
          {campi?.data_acquisto && (
            <p id="errore-data" className="text-xs text-destructive">
              {campi.data_acquisto}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="costo">Costo acquisto (€) *</Label>
          <Input
            id="costo"
            name="costo_acquisto"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            aria-invalid={Boolean(campi?.costo_acquisto)}
            aria-describedby={campi?.costo_acquisto ? "errore-costo" : undefined}
          />
          {campi?.costo_acquisto && (
            <p id="errore-costo" className="text-xs text-destructive">
              {campi.costo_acquisto}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fonte">Fonte acquisto *</Label>
        <Input
          id="fonte"
          name="fonte_acquisto"
          list="lista-fonti"
          autoComplete="off"
          defaultValue="Vinted"
          placeholder="Da dove arriva?"
          aria-invalid={Boolean(campi?.fonte_acquisto)}
          aria-describedby={campi?.fonte_acquisto ? "errore-fonte" : undefined}
        />
        <datalist id="lista-fonti">
          {FONTI_ACQUISTO.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        {campi?.fonte_acquisto && (
          <p id="errore-fonte" className="text-xs text-destructive">
            {campi.fonte_acquisto}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note</Label>
        <Textarea
          id="note"
          name="note"
          placeholder="Stato estetico, accessori inclusi, difetti…"
          rows={3}
        />
      </div>
    </>
  );
}

export function InserimentoForm({ prodotti }: { prodotti: ProdottoNoto[] }) {
  const [stato, action] = useActionState<StatoInserimento, FormData>(creaArticolo, { seq: 0 });

  // I toast sì possono stare in un effect: sonner è un sistema esterno, non
  // stato React.
  useEffect(() => {
    if (stato.seq === 0) return;
    toast.success("Articolo registrato", {
      description: stato.prodottoCreato
        ? `Nuovo modello aggiunto al catalogo: ${stato.prodottoCreato}`
        : undefined,
    });
  }, [stato.seq, stato.prodottoCreato]);

  useEffect(() => {
    if (stato.errore) toast.error(stato.errore);
  }, [stato.errore]);

  // Non bloccante (il salvataggio è comunque riuscito): tipicamente il
  // barcode non collegabile perché il prodotto ne aveva già uno diverso.
  useEffect(() => {
    if (stato.avviso) toast.warning(stato.avviso);
  }, [stato.avviso]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <CampiInserimento key={stato.seq} prodotti={prodotti} campi={stato.campi} />
      <BottoneSalva />
    </form>
  );
}
