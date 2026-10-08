"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Badge, Button, Card, Chip, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { LEVEL_TONE } from "@/components/flashcard";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi } from "@/lib/client";

interface Verb { id: string; verbRank: number; rank: number | null; base: string; past: string | null; participle: string | null; translation: string; ipa: string | null; example: string | null; exampleTranslation: string | null; level: string; irregular: boolean; inCards: boolean }

export function VerbsView() {
  const toast = useToast();
  const [top, setTop] = useState(20);
  const [irregular, setIrregular] = useState(false);
  const { data, error, loading, reload } = useApi<{ verbs: Verb[] }>(`/api/verbs?top=${top}${irregular ? "&irregular=1" : ""}`);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  async function add(id: string) {
    try { await api("/api/cards/from-vocabulary", { method: "POST", json: { vocabularyId: id } }); setAdded((a) => ({ ...a, [id]: true })); invalidate("/api/"); toast("Ajouté à vos cartes ✅", "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }
  return (
    <div>
      <PageHeader title="Most Common Verbs" subtitle="Les verbes anglais les plus fréquents, avec leurs formes (base · past simple · participe passé)." />
      <div className="mb-5 flex flex-wrap gap-2">
        {[20, 50, 100].map((n) => <Chip key={n} active={top === n} onClick={() => setTop(n)}>Top {n}</Chip>)}
        <Chip active={irregular} onClick={() => setIrregular(!irregular)}>Irréguliers seulement</Chip>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.verbs.map((v) => (
            <li key={v.id}>
              <Card className="flex h-full flex-col gap-3 !p-4">
                <div className="flex items-start justify-between">
                  <div><div className="text-xs text-muted">#{v.verbRank}{v.rank ? ` · rank ${v.rank}` : ""}</div><h2 className="text-2xl font-semibold uppercase tracking-wide" lang="en">{v.base}</h2>{v.ipa && <div className="text-sm text-muted">/{v.ipa}/</div>}</div>
                  <div className="flex flex-col items-end gap-1"><Badge tone={LEVEL_TONE[v.level]}>{v.level}</Badge>{v.irregular && <Badge tone="warn">Irregular</Badge>}</div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Past:</dt><dd className="font-semibold" lang="en">{v.past}</dd>
                  <dt className="text-muted">Past participle:</dt><dd className="font-semibold" lang="en">{v.participle}</dd>
                  <dt className="text-muted">French:</dt><dd className="font-semibold">{v.translation}</dd>
                </dl>
                {v.example && <p className="rounded-xl bg-surface-2 p-2.5 text-sm"><span lang="en">{v.example}</span><span className="block text-muted">{v.exampleTranslation}</span></p>}
                <div className="mt-auto flex items-center gap-2">
                  <SpeakButton text={v.base} label="Listen" className="flex-1" />
                  {v.inCards || added[v.id] ? <span className="inline-flex h-11 items-center gap-1 px-2 text-sm text-accent"><Check className="size-4" /> Dans mes cartes</span> : <Button variant="secondary" onClick={() => add(v.id)} aria-label={`Ajouter ${v.base}`}><Plus className="size-4" /> Cartes</Button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
