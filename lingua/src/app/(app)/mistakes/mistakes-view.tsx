"use client";
import Link from "next/link";
import { useState } from "react";
import { Play } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { HBar } from "@/components/charts";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi } from "@/lib/client";

interface M { id: string; original: string; corrected: string; explanation: string; category: string; source: string; flashcardId: string | null; createdAt: string; skill: { slug: string; name: string } | null }

export function MistakesView() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: M[]; total: number; summary: { label: string; slug: string | null; count: number }[] }>("/api/mistakes", { ttl: 5000 });
  const [busy, setBusy] = useState("");

  async function one(id: string) {
    setBusy(id);
    try { await api(`/api/mistakes/${id}/card`, { method: "POST" }); toast("Ajoutée à « My Mistakes » ✅", "success"); invalidate("/api/"); reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
    setBusy("");
  }
  async function all() {
    setBusy("all");
    try { const r = await api<{ created: number }>("/api/mistakes/cards", { method: "POST", json: {} }); toast(`${r.created} cartes créées`, "success"); invalidate("/api/"); reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
    setBusy("");
  }
  const pending = data?.items.filter((m) => !m.flashcardId).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="My Mistakes" subtitle="Vos erreurs récurrentes, détectées dans les conversations et les exercices." actions={<>
        {pending > 0 && <Button variant="secondary" loading={busy === "all"} onClick={all}>Tout ajouter aux flashcards ({pending})</Button>}
        <Link href="/review?preset=mistakes&n=20" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink hover:brightness-110"><Play className="size-4" /> Réviser mes erreurs</Link>
      </>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton className="h-64" /> : data && data.total === 0 ? (
        <EmptyState icon="🌟" title="Aucune erreur enregistrée" action={<Link href="/conversation"><Button>Parler avec le prof IA</Button></Link>}>Les erreurs importantes repérées dans vos conversations et exercices apparaîtront ici.</EmptyState>
      ) : (
        <>
          <Card><h2 className="mb-3 font-semibold">Erreurs récurrentes</h2>
            <div className="space-y-3">{data?.summary.map((s) => <HBar key={s.label} label={s.label} value={s.count} max={data.summary[0].count} right={`${s.count} mistakes`} tone="warn" />)}</div></Card>
          <ul className="space-y-2">
            {data?.items.map((m) => (
              <li key={m.id}><Card className="space-y-2 !p-4">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="warn">{m.skill?.name ?? m.category}</Badge><Badge>{{ CONVERSATION: "Conversation", EXERCISE: "Exercice", PLACEMENT: "Test", MANUAL: "Manuel" }[m.source]}</Badge><span className="ml-auto text-xs text-muted">{new Date(m.createdAt).toLocaleDateString("fr-FR")}</span></div>
                <p className="text-sm"><span className="text-danger line-through" lang="en">{m.original}</span></p>
                <p className="text-sm font-medium text-accent" lang="en">→ {m.corrected}</p>
                <p className="text-sm text-muted">{m.explanation}</p>
                <div className="flex gap-2">
                  {m.flashcardId ? <Badge tone="good">🃏 Dans mes flashcards</Badge> : <Button size="sm" variant="secondary" loading={busy === m.id} onClick={() => one(m.id)}>Add to my flashcards</Button>}
                  {m.skill && <Link href={`/grammar/${m.skill.slug}`} className="inline-flex h-9 items-center text-sm text-brand hover:underline">Revoir la leçon</Link>}
                </div>
              </Card></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
