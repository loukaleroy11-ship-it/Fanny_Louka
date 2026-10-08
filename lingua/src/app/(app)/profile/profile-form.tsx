"use client";
import { useState } from "react";
import { Button, Card, Chip, Field, Input } from "@/components/ui";
import { useToast, useUser } from "@/components/providers";

const MINUTES = [5, 10, 15, 20, 30, 45, 60];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const GOALS = ["Parler anglais au quotidien", "Voyager", "Travail / carrière", "Études à l'étranger", "Passer un examen", "Vivre à l'étranger (ex. Australie)", "Comprendre films et séries"];

export function ProfileForm() {
  const { user, update } = useUser();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [goal, setGoal] = useState(user.goal);
  const [counts, setCounts] = useState({ dailyNewCards: user.dailyNewCards, dailyReviewCards: user.dailyReviewCards, dailyConversations: user.dailyConversations });
  const num = (k: keyof typeof counts) => (e: React.ChangeEvent<HTMLInputElement>) => setCounts({ ...counts, [k]: Math.max(0, Number(e.target.value) || 0) });

  return (
    <Card className="space-y-6">
      <h2 className="font-semibold">Mon profil et mes objectifs</h2>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); await update({ name, goal }); toast("Profil enregistré", "success"); }}>
        <Field label="Prénom" htmlFor="p-name"><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="Objectif" htmlFor="p-goal"><Input id="p-goal" list="goals" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={120} /><datalist id="goals">{GOALS.map((g) => <option key={g} value={g} />)}</datalist></Field>
        <div className="sm:col-span-2"><Button type="submit">Enregistrer</Button></div>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Objectif quotidien (temps)</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Objectif quotidien">{MINUTES.map((m) => <Chip key={m} active={user.dailyMinutes === m} onClick={() => void update({ dailyMinutes: m })}>{m} min</Chip>)}</div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Cartes à réviser / jour" htmlFor="g-rev"><Input id="g-rev" type="number" min={0} max={500} value={counts.dailyReviewCards} onChange={num("dailyReviewCards")} onBlur={() => void update({ dailyReviewCards: counts.dailyReviewCards })} /></Field>
        <Field label="Nouveaux mots / jour" htmlFor="g-new"><Input id="g-new" type="number" min={0} max={100} value={counts.dailyNewCards} onChange={num("dailyNewCards")} onBlur={() => void update({ dailyNewCards: counts.dailyNewCards })} /></Field>
        <Field label="Conversations / jour" htmlFor="g-conv"><Input id="g-conv" type="number" min={0} max={10} value={counts.dailyConversations} onChange={num("dailyConversations")} onBlur={() => void update({ dailyConversations: counts.dailyConversations })} /></Field>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Niveau déclaré</h3>
        <p className="text-xs text-muted">Votre niveau est estimé automatiquement. Vous pouvez le corriger manuellement ici (le professeur IA s&apos;adaptera).</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Niveau">{LEVELS.map((l) => <Chip key={l} active={user.level === l} onClick={() => void update({ level: l })}>{l}</Chip>)}</div>
      </section>
    </Card>
  );
}
