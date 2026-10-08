"use client";
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Input, PageHeader, Skeleton } from "@/components/ui";
import { SpeakButton } from "@/components/speak";
import { LEVEL_TONE } from "@/components/flashcard";
import { useToast } from "@/components/providers";
import { api, invalidate, useApi, useDebounced } from "@/lib/client";
import { FUNCTION_FILTERS, FUNCTION_LABEL, type FunctionKey } from "@/lib/labels";
import type { VocabDto } from "@/lib/serialize";

export function VocabularyView() {
  const toast = useToast();
  const [fn, setFn] = useState<FunctionKey>("verb");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [fn, level, dq]);
  const { data, error, loading, reload } = useApi<{ total: number; items: (VocabDto & { inCards: boolean })[]; counts: Record<string, number> }>(`/api/vocabulary?fn=${fn}${level ? `&level=${level}` : ""}${dq ? `&q=${encodeURIComponent(dq)}` : ""}&page=${page}`);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const count = (k: FunctionKey) => FUNCTION_FILTERS[k].reduce((n, p) => n + (data?.counts[p] ?? 0), 0);

  async function add(id: string) {
    try { await api("/api/cards/from-vocabulary", { method: "POST", json: { vocabularyId: id } }); setAdded((a) => ({ ...a, [id]: true })); invalidate("/api/"); toast("Ajouté à vos cartes ✅", "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }
  const pages = data ? Math.ceil(data.total / 40) : 1;

  return (
    <div>
      <PageHeader title="Vocabulaire par fonction" subtitle="Explorez les mots selon leur rôle grammatical, classés par fréquence." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Fonction grammaticale">
        {(Object.keys(FUNCTION_LABEL) as FunctionKey[]).map((k) => <Chip key={k} active={fn === k} onClick={() => setFn(k)}>{FUNCTION_LABEL[k]}{data ? <span className="ml-1.5 text-xs opacity-70">{count(k)}</span> : null}</Chip>)}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer les mots" className="max-w-xs" />
        {["", "A1", "A2", "B1", "B2"].map((l) => <Chip key={l} active={level === l} onClick={() => setLevel(l)}>{l || "Tous niveaux"}</Chip>)}
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : data && data.items.length === 0 ? (
        <EmptyState icon="📭" title="Aucun mot">Aucun mot ne correspond à ce filtre.</EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">{data?.total} mots</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data?.items.map((v) => (
              <li key={v.id}><Card className="flex items-center gap-3 !p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2"><b className="text-lg" lang="en">{v.word}</b>{v.ipa && <span className="text-xs text-muted">/{v.ipa}/</span>}</div>
                  <div className="truncate text-sm text-muted">{v.translation}</div>
                  <div className="mt-1 flex gap-1.5">{v.rank && <Badge tone="brand">#{v.rank}</Badge>}<Badge tone={LEVEL_TONE[v.level]}>{v.level}</Badge></div>
                </div>
                <SpeakButton text={v.word} compact label="Listen" />
                {v.inCards || added[v.id] ? <span className="grid size-11 place-items-center text-accent" title="Dans vos cartes"><Check className="size-5" /></span> : <Button variant="secondary" size="sm" onClick={() => add(v.id)} aria-label={`Ajouter ${v.word} à mes cartes`}><Plus className="size-4" /></Button>}
              </Card></li>
            ))}
          </ul>
          {pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button><span className="text-sm tabular-nums">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</Button></div>}
        </>
      )}
    </div>
  );
}
