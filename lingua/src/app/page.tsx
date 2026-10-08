import Link from "next/link";
import { registrationOpen } from "@/lib/registration";
import { Brain, Flame, GraduationCap, Layers, MessageCircle, Mic, Repeat, Sparkles, Target } from "lucide-react";

const FEATURES = [
  { icon: Repeat, title: "Répétition espacée FSRS", text: "L'algorithme moderne d'Anki : chaque carte revient juste avant que vous l'oubliiez." },
  { icon: MessageCircle, title: "Prof d'anglais IA", text: "Conversations en 16 scénarios, corrections discrètes, adaptées à votre niveau A1 → C1." },
  { icon: Target, title: "Vos erreurs deviennent des cartes", text: "Chaque faute détectée est mémorisée, priorisée et transformée en flashcard." },
  { icon: Layers, title: "500 mots les plus utilisés", text: "Classés par fréquence réelle, filtrables par rang, par fonction grammaticale et par niveau." },
  { icon: Mic, title: "Parlez, écoutez", text: "Micro et synthèse vocale en accent US ou UK, vitesse réglable." },
  { icon: GraduationCap, title: "Grammaire & exercices", text: "Les 5 temps essentiels expliqués simplement, avec exercices corrigés." },
];

export const dynamic = "force-dynamic";

export default function Landing() {
  const signup = registrationOpen() ? "/register" : "/login";
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <span className="flex items-center gap-2 text-lg font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-ink"><Sparkles className="size-5" /></span> Lingua</span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium hover:bg-surface-2">Connexion</Link>
          <Link href={signup} className="inline-flex h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink hover:brightness-110">Commencer</Link>
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:pt-24">
          <span className="anim-up inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand"><Flame className="size-4" /> Anki + Duolingo + prof particulier</span>
          <h1 className="anim-up mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">Un professeur d&apos;anglais personnel,<br /><span className="text-brand">dans vos flashcards.</span></h1>
          <p className="anim-up mx-auto mt-6 max-w-2xl text-lg text-muted">Comprendre l&apos;anglais parlé, parler sans peur : Lingua vous fait écouter, répéter et discuter, apprend ce que vous ratez et décide chaque jour de ce que vous devez travailler. De A1 à C1.</p>
          <div className="anim-up mt-8 flex flex-wrap justify-center gap-3">
            <Link href={signup} className="inline-flex h-12 items-center rounded-xl bg-brand px-7 font-medium text-brand-ink hover:brightness-110">Se connecter</Link>
            
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fonctionnalités">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6 shadow-card">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><f.icon className="size-5" /></span>
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted"><Brain className="mx-auto mb-2 size-5" />Lingua — apprenez l&apos;anglais intelligemment.</footer>
    </div>
  );
}
