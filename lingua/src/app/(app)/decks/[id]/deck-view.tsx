"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { Button, Card, ErrorState, Modal, PageHeader, Progress } from "@/components/ui";
import { CardBrowser } from "@/components/card-browser";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi } from "@/lib/client";

export function DeckView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, reload } = useApi<{ deck: { id: string; name: string; description: string | null; kind: string; total: number; due: number; newCards: number; mastered: number; learned: number } }>(`/api/decks/${id}`, { ttl: 5000 });
  const [confirm, setConfirm] = useState(false);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data?.deck;

  async function remove() {
    try { await api(`/api/decks/${id}`, { method: "DELETE" }); invalidate("/api/"); toast("Deck supprimé (les cartes sont conservées)", "success"); router.push("/decks"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }
  return (
    <div className="space-y-5">
      <Link href="/decks" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Decks</Link>
      <PageHeader title={d?.name ?? "…"} subtitle={d?.description} actions={<>
        <Link href={`/review?deck=${id}&n=20`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink hover:brightness-110"><Play className="size-4" /> Réviser ce deck</Link>
        {d?.kind === "CUSTOM" && d.name !== "My Words" && <Button variant="ghost" onClick={() => setConfirm(true)} aria-label="Supprimer le deck"><Trash2 className="size-4 text-danger" /></Button>}
      </>} />
      {d && (
        <Card className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:items-center">
          <div className="col-span-2"><Progress value={d.total ? d.learned / d.total : 0} label="Progression du deck" /><p className="mt-1 text-xs text-muted">{d.learned} / {d.total} cartes apprises</p></div>
          <div className="text-center"><div className="text-xl font-semibold tabular-nums text-warn">{d.due}</div><div className="text-xs text-muted">à revoir</div></div>
          <div className="text-center"><div className="text-xl font-semibold tabular-nums">{d.newCards}</div><div className="text-xs text-muted">jamais vues</div></div>
          <div className="text-center"><div className="text-xl font-semibold tabular-nums text-accent">{d.mastered}</div><div className="text-xs text-muted">maîtrisées</div></div>
        </Card>
      )}
      <CardBrowser deckId={id} defaultSort={d?.kind === "COMMON500" ? "rank" : "newest"} key={d?.kind} allowCreate={d?.kind !== "COMMON500"} />
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Supprimer ce deck ?">
        <p className="text-sm text-muted">Les cartes restent dans « My Cards » ; seul le deck est supprimé.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button><Button variant="danger" onClick={remove}>Supprimer</Button></div>
      </Modal>
    </div>
  );
}
