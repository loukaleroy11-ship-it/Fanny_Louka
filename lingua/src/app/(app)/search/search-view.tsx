"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { LEVEL_TONE } from "@/components/flashcard";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi } from "@/lib/client";
import type { VocabDto } from "@/lib/serialize";

type Result = VocabDto & { inCards: boolean; cardId: string | null; forms: string[] };
interface Resp { results: Result[]; cognates: { id: string; english: string; french: string; kind: string; meaning: string }[]; lessons: { slug: string; title: string; titleFr: string; level: string }[] }

export function SearchView() {
  const q = useSearchParams().get("q") ?? "";
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Resp>(q ? `/api/search?q=${encodeURIComponent(q)}` : null, { ttl: 10_000 });
  const [added, setAdded] = useState<Record<string, boolean>>({});

  async function add(id: string) {
    try { await api("/api/cards/from-vocabulary", { method: "POST", json: { vocabularyId: id } }); setAdded((a) => ({ ...a, [id]: true })); invalidate("/api/"); toast("Ajouté à vos cartes ✅", "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }

  if (!q) return <EmptyState icon="🔎" title="Recherche globale">Saisissez un mot anglais ou français dans la barre de recherche (ex. « run », « courir »).</EmptyState>;
  return (
    <div>
      <PageHeader title={`Résultats pour « ${q} »`} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div> : (
        <div className="space-y-4">
          {data?.results.length === 0 && <EmptyState icon="🤷" title="Aucun résultat">Essayez une autre orthographe, ou <Link className="text-brand underline" href="/cards">créez la carte vous-même</Link> (avec l&apos;aide de l&apos;IA).</EmptyState>}
          {data?.results.map((r) => {
            const have = r.inCards || added[r.id];
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2"><h2 className="text-2xl font-semibold capitalize" lang="en">{r.word}</h2>{r.ipa && <span className="text-muted">/{r.ipa}/</span>}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.rank && <Badge tone="brand">Rank #{r.rank}</Badge>}<Badge>{r.category}</Badge><Badge tone={LEVEL_TONE[r.level]}>{r.level}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <SpeakButton text={r.word} label="Listen" />
                    {have ? <Link href={`/cards`}><Button variant="secondary" size="md"><Check className="size-4 text-accent" /> Dans mes cartes</Button></Link> : <Button onClick={() => add(r.id)}><Plus className="size-4" /> Add to cards</Button>}
                  </div>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2"><dt className="text-muted">Translation:</dt><dd className="font-medium">{r.translation}</dd></div>
                  {r.pastSimple && <div className="flex gap-2"><dt className="text-muted">Past:</dt><dd className="font-medium">{r.pastSimple}</dd></div>}
                  {r.pastParticiple && <div className="flex gap-2"><dt className="text-muted">Past participle:</dt><dd className="font-medium">{r.pastParticiple}</dd></div>}
                  {r.lemma && <div className="flex gap-2"><dt className="text-muted">Forme de:</dt><dd className="font-medium">{r.lemma.word}</dd></div>}
                </dl>
                {r.forms.length > 0 && <p className="text-sm"><span className="text-muted">Related words:</span> {r.forms.map((f) => <Link key={f} href={`/search?q=${encodeURIComponent(f)}`} className="mr-1.5 inline-flex h-9 items-center rounded-full bg-brand-soft px-3 text-brand hover:underline">{f}</Link>)}</p>}
                {r.example && <p className="rounded-xl bg-surface-2 p-3 text-sm"><span lang="en">{r.example}</span><span className="block text-muted">{r.exampleTranslation}</span></p>}
              </Card>
            );
          })}
          {data && data.cognates.length > 0 && (
            <Card><h2 className="mb-2 font-semibold">Mots apparentés / faux amis</h2>
              <ul className="space-y-1 text-sm">{data.cognates.map((c) => <li key={c.id}><b>{c.english}</b> ↔ {c.french} {c.kind === "FALSE_FRIEND" ? <Badge tone="bad">Faux ami</Badge> : <Badge tone="good">Apparenté</Badge>} <span className="text-muted">{c.kind === "FALSE_FRIEND" ? c.meaning : ""}</span></li>)}</ul></Card>
          )}
          {data && data.lessons.length > 0 && (
            <Card><h2 className="mb-2 font-semibold">Leçons de grammaire</h2>{data.lessons.map((l) => <Link key={l.slug} href={`/grammar/${l.slug}`} className="mr-3 text-brand hover:underline">{l.title} ({l.titleFr})</Link>)}</Card>
          )}
        </div>
      )}
    </div>
  );
}
