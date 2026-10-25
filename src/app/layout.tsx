import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// Archivo is a variable font with a width axis (62–125): condensed signage ↔ expanded display from one family.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], style: ["normal", "italic"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Plumbline — say what happened, prove it later", template: "%s · Plumbline" },
  description:
    "Voice-to-evidence for construction. Dictate the day; Plumbline structures it, starts your contractual notice clocks, corroborates it with weather data and seals it in a tamper-evident log.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Plumbline", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0a0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
