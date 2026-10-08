"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client";

function Form() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await api<{ next: string }>("/api/auth/login", { method: "POST", json: { email, password } });
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : r.next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  }

  return (
    <Card className="anim-up">
      <h1 className="text-2xl font-semibold">Content de vous revoir 👋</h1>
      <p className="mt-1 text-sm text-muted">Connectez-vous pour reprendre votre apprentissage.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Mot de passe" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>Se connecter</Button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand hover:underline">Mot de passe oublié ?</Link>
        <Link href="/register" className="text-brand hover:underline">Créer un compte</Link>
      </div>
    </Card>
  );
}

export function LoginForm() {
  return <Suspense><Form /></Suspense>;
}
