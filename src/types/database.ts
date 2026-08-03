/**
 * Tipi dello schema Postgres, generati da Supabase.
 *
 * Rigenerare dopo ogni migration:
 *   supabase gen types typescript --project-id uvefekvddgxwuxhnhhmd > src/types/database.ts
 * (oppure via MCP: generate_typescript_types)
 *
 * Non modificare a mano: le modifiche vengono sovrascritte.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      articoli: {
        Row: {
          costo_acquisto: number;
          costo_spedizione: number | null;
          created_at: string;
          data_acquisto: string;
          data_vendita: string | null;
          destinazione: string | null;
          fee: number | null;
          fonte_acquisto: string;
          id: string;
          note: string | null;
          paese_vendita: string | null;
          piattaforma_vendita: string | null;
          prezzo_vendita: number | null;
          prodotto_id: string;
          prodotto_sponsorizzato: boolean;
          profitto: number | null;
          spedizioniere: string | null;
          stato: string;
          vendita_post_offerta: boolean;
        };
        Insert: {
          costo_acquisto: number;
          costo_spedizione?: number | null;
          created_at?: string;
          data_acquisto: string;
          data_vendita?: string | null;
          destinazione?: string | null;
          fee?: number | null;
          fonte_acquisto: string;
          id?: string;
          note?: string | null;
          paese_vendita?: string | null;
          piattaforma_vendita?: string | null;
          prezzo_vendita?: number | null;
          prodotto_id: string;
          prodotto_sponsorizzato?: boolean;
          profitto?: number | null;
          spedizioniere?: string | null;
          stato?: string;
          vendita_post_offerta?: boolean;
        };
        Update: {
          costo_acquisto?: number;
          costo_spedizione?: number | null;
          created_at?: string;
          data_acquisto?: string;
          data_vendita?: string | null;
          destinazione?: string | null;
          fee?: number | null;
          fonte_acquisto?: string;
          id?: string;
          note?: string | null;
          paese_vendita?: string | null;
          piattaforma_vendita?: string | null;
          prezzo_vendita?: number | null;
          prodotto_id?: string;
          prodotto_sponsorizzato?: boolean;
          profitto?: number | null;
          spedizioniere?: string | null;
          stato?: string;
          vendita_post_offerta?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "articoli_prodotto_id_fkey";
            columns: ["prodotto_id"];
            isOneToOne: false;
            referencedRelation: "prodotti";
            referencedColumns: ["id"];
          },
        ];
      };
      // Piattaforme di vendita, fonti di acquisto e spedizionieri configurabili
      // (0013_canali_configurabili): `tipo` distingue le tre entità, non è un
      // enum Postgres perché sono valori di dati, non uno schema chiuso.
      canali: {
        Row: {
          attivo: boolean;
          created_at: string;
          id: string;
          nome: string;
          ordine: number;
          tipo: string;
        };
        Insert: {
          attivo?: boolean;
          created_at?: string;
          id?: string;
          nome: string;
          ordine?: number;
          tipo: string;
        };
        Update: {
          attivo?: boolean;
          created_at?: string;
          id?: string;
          nome?: string;
          ordine?: number;
          tipo?: string;
        };
        Relationships: [];
      };
      impostazioni: {
        Row: { chiave: string; created_at: string; id: string; valore: Json | null };
        Insert: { chiave: string; created_at?: string; id?: string; valore?: Json | null };
        Update: { chiave?: string; created_at?: string; id?: string; valore?: Json | null };
        Relationships: [];
      };
      prodotti: {
        Row: {
          barcode: string | null;
          categoria: string | null;
          created_at: string;
          foto_url: string | null;
          id: string;
          nome: string;
          note: string | null;
          piattaforma_gioco: string | null;
          prezzo_medio_acquisto: number | null;
          prezzo_medio_vendita: number | null;
        };
        Insert: {
          barcode?: string | null;
          categoria?: string | null;
          created_at?: string;
          foto_url?: string | null;
          id?: string;
          nome: string;
          note?: string | null;
          piattaforma_gioco?: string | null;
          prezzo_medio_acquisto?: number | null;
          prezzo_medio_vendita?: number | null;
        };
        Update: {
          barcode?: string | null;
          categoria?: string | null;
          created_at?: string;
          foto_url?: string | null;
          id?: string;
          nome?: string;
          note?: string | null;
          piattaforma_gioco?: string | null;
          prezzo_medio_acquisto?: number | null;
          prezzo_medio_vendita?: number | null;
        };
        Relationships: [];
      };
      utenti_autorizzati: {
        Row: { created_at: string; email: string; note: string | null };
        Insert: { created_at?: string; email: string; note?: string | null };
        Update: { created_at?: string; email?: string; note?: string | null };
        Relationships: [];
      };
    };
    Views: {
      v_vendite_mensili: {
        Row: {
          mese: string | null;
          numero_vendite: number | null;
          prezzo_medio_vendita: number | null;
          profitto_totale: number | null;
          totale_vendite: number | null;
        };
        Relationships: [];
      };
      v_kpi: {
        Row: {
          numero_vendite: number | null;
          prezzo_medio_vendita: number | null;
          vendite_totali: number | null;
          profitto_totale: number | null;
          fondi_immobilizzati: number | null;
          capitale: number | null;
        };
        Relationships: [];
      };
      // Conteggio articoli per stringa storica di canale, per tipo (0013):
      // a supporto della pagina Impostazioni, per mostrare quanti articoli
      // usano ciascun canale prima di disattivarlo o rinominarlo.
      v_conteggio_canali: {
        Row: { conteggio: number | null; nome: string | null; tipo: string | null };
        Relationships: [];
      };
      v_distribuzione_categoria: {
        Row: { label: string | null; value: number | null };
        Relationships: [];
      };
      v_distribuzione_piattaforma: {
        Row: { label: string | null; value: number | null };
        Relationships: [];
      };
      v_distribuzione_fonte: {
        Row: { label: string | null; value: number | null };
        Relationships: [];
      };
      v_distribuzione_destinazione: {
        Row: { label: string | null; value: number | null };
        Relationships: [];
      };
      v_vendite_per_paese_anno: {
        Row: {
          anno: number | null;
          paese: string | null;
          numero_vendite: number | null;
          totale_vendite: number | null;
          profitto_totale: number | null;
          // Aggiunta da 0012: per le righe paese=null distingue 'Estero'
          // (certamente fuori Italia, paese ignoto) da null (destinazione
          // stessa ignota). Per le righe con paese noto è deterministica
          // ('Italia' o 'Estero') e non aggiunge informazione.
          destinazione: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      ricalcola_prezzi_medi: { Args: never; Returns: undefined };
      // Funzioni di supporto dell'estensione pg_trgm (0007_ricerca_prodotti_trgm):
      // esposte dallo schema `public` in cui l'estensione è installata, non
      // chiamate dall'app.
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      utente_autorizzato: { Args: never; Returns: boolean };
      // Funzioni RPC del filtro periodo (0010_funzioni_dashboard_periodo.sql):
      // p_da/p_a nulli = nessun limite. Tenute in un'unica implementazione,
      // di cui le viste v_kpi/v_vendite_mensili/v_distribuzione_* sono involucri.
      dashboard_kpi: {
        Args: { p_da: string | null; p_a: string | null };
        Returns: {
          numero_vendite: number;
          prezzo_medio_vendita: number;
          vendite_totali: number;
          profitto_totale: number;
          fondi_immobilizzati: number;
          capitale: number;
        }[];
      };
      dashboard_vendite_mensili: {
        Args: { p_da: string | null; p_a: string | null };
        Returns: {
          mese: string;
          numero_vendite: number;
          prezzo_medio_vendita: number;
          totale_vendite: number;
          profitto_totale: number;
        }[];
      };
      dashboard_distribuzione_categoria: {
        Args: { p_da: string | null; p_a: string | null };
        Returns: { label: string; value: number }[];
      };
      dashboard_distribuzione_piattaforma: {
        Args: { p_da: string | null; p_a: string | null };
        Returns: { label: string; value: number }[];
      };
      dashboard_distribuzione_fonte: {
        Args: { p_da: string | null; p_a: string | null };
        Returns: { label: string; value: number }[];
      };
      dashboard_distribuzione_destinazione: {
        Args: { p_da: string | null; p_a: string | null };
        Returns: { label: string; value: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never;
