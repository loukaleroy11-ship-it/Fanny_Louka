"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client";

export default function Page() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setDone(await api("/api/auth/forgot-password", { method: "POST", json: { email } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
    setLoading(false);
  }

  return (
    <Card className="anim-up">
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      {done ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-accent" role="status">{done.message}</p>
          {done.devLink && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-warn">
              Mode développement (aucun service e-mail configuré) : <Link className="font-medium underline" href={done.devLink}>ouvrir le lien de réinitialisation</Link>
            </p>
          )}
          <Link href="/login" className="text-brand hover:underline">Retour à la connexion</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-sm text-muted">Saisissez votre email, nous vous enverrons un lien valable 1 heure.</p>
          <Field label="Email" htmlFor="email"><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Envoyer le lien</Button>
          <p className="text-center text-sm"><Link href="/login" className="text-brand hover:underline">Retour</Link></p>
        </form>
      )}
    </Card>
  );
}
