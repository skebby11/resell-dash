import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Inter: neutra e molto leggibile per testo e UI, sostituisce Manrope che il
// cliente trovava troppo sottile.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Barlow Condensed: la condensata pesante/corsiva più vicina, fra i Google
// Fonts, al lettering del brand "DIECI MENO" (bastone, condensato, corsivo,
// maiuscolo). Sostituisce Fraunces, un serif "wonky" giudicato troppo
// leggero per il nuovo posizionamento. Si carica solo nei pesi usati.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rewind — Dashboard Reselling",
  description: "Dashboard di gestione acquisti e rivendite retrogaming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${inter.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
