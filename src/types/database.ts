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
          piattaforma_vendita?: string | null;
          prezzo_vendita?: number | null;
          prodotto_id: string;
          prodotto_sponsorizzato?: boolean;
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
          piattaforma_vendita?: string | null;
          prezzo_vendita?: number | null;
          prodotto_id?: string;
          prodotto_sponsorizzato?: boolean;
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
    };
    Functions: {
      ricalcola_prezzi_medi: { Args: never; Returns: undefined };
      // Funzioni di supporto dell'estensione pg_trgm (0007_ricerca_prodotti_trgm):
      // esposte dallo schema `public` in cui l'estensione è installata, non
      // chiamate dall'app.
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      utente_autorizzato: { Args: never; Returns: boolean };
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
