import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "./fonts/Cinzel.ttf",
  variable: "--font-display",
  weight: "400 900",
});

const body = localFont({
  src: "./fonts/Jost.ttf",
  variable: "--font-body",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "La Table 21 — Blackjack",
  description: "Une table de Blackjack multijoueur, premium et cinématique.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="h-dvh flex flex-col">{children}</body>
    </html>
  );
}
