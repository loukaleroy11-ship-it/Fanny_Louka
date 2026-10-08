"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/reset-password", { method: "POST", json: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
    setLoading(false);
  }
  return (
    <Card className="anim-up">
      <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
      {done ? (
        <p className="mt-4 text-sm" role="status">Mot de passe modifié ✅ <Link href="/login" className="text-brand hover:underline">Se connecter</Link></p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Nouveau mot de passe" htmlFor="pw" hint="8 caractères minimum"><Input id="pw" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!token}>Enregistrer</Button>
          {!token && <p className="text-sm text-danger">Lien invalide : jeton manquant.</p>}
        </form>
      )}
    </Card>
  );
}

export default function Page() {
  return <Suspense><Form /></Suspense>;
}
