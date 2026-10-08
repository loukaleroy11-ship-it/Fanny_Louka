"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client";

export default function Page() {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    setLoading(true);
    setError("");
    try {
      const r = await api<{ next: string }>("/api/auth/register", { method: "POST", json: { ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      window.location.href = r.next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  }

  return (
    <Card className="anim-up">
      <h1 className="text-2xl font-semibold">Créer votre compte</h1>
      <p className="mt-1 text-sm text-muted">Gratuit. Un test de niveau de 5 minutes personnalisera votre programme.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Prénom" htmlFor="name"><Input id="name" autoComplete="given-name" required value={f.name} onChange={set("name")} /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Mot de passe" htmlFor="password" hint="8 caractères minimum"><Input id="password" type="password" autoComplete="new-password" required value={f.password} onChange={set("password")} /></Field>
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Créer mon compte</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">Déjà inscrit ? <Link href="/login" className="text-brand hover:underline">Se connecter</Link></p>
    </Card>
  );
}
