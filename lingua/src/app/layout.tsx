import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lingua — Apprenez l'anglais avec un prof IA", template: "%s · Lingua" },
  description: "Flashcards à répétition espacée (FSRS), professeur d'anglais IA, grammaire et suivi de progression de A1 à C2.",
  applicationName: "Lingua",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f7fb" }, { media: "(prefers-color-scheme: dark)", color: "#0a0c15" }],
};

// Runs before hydration to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('lingua-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
