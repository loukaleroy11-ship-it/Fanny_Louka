"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, FolderPlus, Play } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Progress, Skeleton } from "@/components/ui";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi } from "@/lib/client";

interface DeckRow { id: string; name: string; description: string | null; kind: string; total: number; newCards: number; due: number; mastered: number; learned: number; progress: number }

export function DecksPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ decks: DeckRow[]; catalog: { key: string; name: string; description: string }[] }>("/api/decks", { ttl: 5000 });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    try { await api("/api/decks", { method: "POST", json: { name, description: desc || undefined } }); toast("Deck créé", "success"); setOpen(false); setName(""); setDesc(""); invalidate("/api/decks"); reload(); }
    catch (err) { toast(err instanceof Error ? err.message : "Erreur", "error"); }
    setBusy("");
  }
  async function install(key: string) {
    setBusy(key);
    try { const r = await api<{ added: number }>("/api/decks/install", { method: "POST", json: { key } }); toast(`Deck ajouté (${r.added} nouvelles cartes)`, "success"); invalidate("/api/"); reload(); }
    catch (err) { toast(err instanceof Error ? err.message : "Erreur", "error"); }
    setBusy("");
  }

  return (
    <div>
      <PageHeader title="Decks" subtitle="Organisez vos cartes par thème. Un mot présent dans plusieurs decks n'est révisé qu'une seule fois." actions={<Button onClick={() => setOpen(true)}><FolderPlus className="size-4" /> Nouveau deck</Button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.decks.map((d) => (
              <Card key={d.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div><Link href={`/decks/${d.id}`} className="inline-flex min-h-11 items-center text-lg font-semibold hover:text-brand">{d.name}</Link>{d.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{d.description}</p>}</div>
                  {d.kind === "COMMON500" && <Badge tone="brand">Top 500</Badge>}{d.kind === "MISTAKES" && <Badge tone="warn">Erreurs</Badge>}
                </div>
                <Progress value={d.progress} label={`Progression ${d.name}`} />
                <dl className="grid grid-cols-4 gap-1 text-center text-xs">
                  <div><dt className="text-muted">Cartes</dt><dd className="text-base font-semibold tabular-nums">{d.total}</dd></div>
                  <div><dt className="text-muted">À revoir</dt><dd className="text-base font-semibold tabular-nums text-warn">{d.due}</dd></div>
                  <div><dt className="text-muted">Neuves</dt><dd className="text-base font-semibold tabular-nums">{d.newCards}</dd></div>
                  <div><dt className="text-muted">Maîtrisées</dt><dd className="text-base font-semibold tabular-nums text-accent">{d.mastered}</dd></div>
                </dl>
                <div className="mt-auto flex gap-2">
                  <Link href={`/review?deck=${d.id}&n=20`} className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-brand-ink hover:brightness-110 ${d.total === 0 ? "pointer-events-none opacity-50" : ""}`}><Play className="size-4" /> Réviser</Link>
                  <Link href={`/decks/${d.id}`} className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-2">Ouvrir</Link>
                </div>
              </Card>
            ))}
          </div>
          {data && data.catalog.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-semibold">Decks à ajouter</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.catalog.map((c) => (
                  <Card key={c.key} className="flex flex-col gap-3">
                    <div><h3 className="font-semibold">{c.name}</h3><p className="mt-0.5 text-sm text-muted">{c.description}</p></div>
                    <Button variant="secondary" className="mt-auto" loading={busy === c.key} onClick={() => install(c.key)}><Download className="size-4" /> Ajouter à mes decks</Button>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {data?.decks.length === 0 && <EmptyState icon="🗂️" title="Aucun deck">Créez votre premier deck.</EmptyState>}
        </>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau deck">
        <form onSubmit={create} className="space-y-4">
          <Field label="Nom" htmlFor="deck-name"><Input id="deck-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Australia" autoFocus /></Field>
          <Field label="Description (optionnel)" htmlFor="deck-desc"><Input id="deck-desc" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={busy === "create"}>Créer</Button></div>
        </form>
      </Modal>
    </div>
  );
}
