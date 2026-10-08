"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Input, Modal, Select, Skeleton } from "./ui";
import { SpeakButton } from "./speak";
import { CardEditor } from "./card-editor";
import { LEVEL_TONE } from "./flashcard";
import { useToast } from "./providers";
import { api, invalidate, useApi, useDebounced } from "@/lib/client";
import { FUNCTION_LABEL, type FunctionKey } from "@/lib/labels";
import type { CardFilter } from "@/lib/filters";
import type { CardDto } from "@/lib/serialize";

const SORTS: [string, string][] = [
  ["rank", "Par fréquence (rang)"], ["function", "Par fonction"], ["level", "Par niveau"], ["difficulty", "Par difficulté personnelle"],
  ["newest", "Plus récents d'abord"], ["oldest", "Plus anciens d'abord"], ["alpha", "Alphabétique"], ["due", "Prochaine révision"],
];
const RANKS: [number, number][] = [[1, 100], [101, 200], [201, 300], [301, 400], [401, 500]];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const BUCKET: Record<string, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  new: { label: "Nouvelle", tone: "neutral" }, easy: { label: "Facile", tone: "good" }, medium: { label: "Moyen", tone: "warn" }, hard: { label: "Difficile", tone: "bad" },
};
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

interface Props { deckId?: string; scope?: ("mine")[]; allowCreate?: boolean; defaultSort?: string; emptyHint?: string }

/** Searchable / filterable / sortable list of the learner's cards, with create / edit / delete. */
export function CardBrowser({ deckId, scope = [], allowCreate = true, defaultSort = "newest", emptyHint }: Props) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [functions, setFunctions] = useState<FunctionKey[]>([]);
  const [levels, setLevels] = useState<CardFilter["levels"]>([]);
  const [status, setStatus] = useState<CardFilter["status"]>([]);
  const [difficulty, setDifficulty] = useState<CardFilter["difficulty"]>([]);
  const [rankMin, setRankMin] = useState<number | undefined>();
  const [rankMax, setRankMax] = useState<number | undefined>();
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; card?: CardDto | null }>({ open: false });
  const [toDelete, setToDelete] = useState<CardDto | null>(null);

  const filter = useMemo<Partial<CardFilter>>(() => ({
    deckId, scope, q: dq || undefined, functions, levels, status, difficulty, rankMin, rankMax,
  }), [deckId, scope, dq, functions, levels, status, difficulty, rankMin, rankMax]);
  useEffect(() => setPage(1), [filter, sort]);

  const url = `/api/cards?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=${sort}&page=${page}&pageSize=30`;
  const { data, error, loading, reload } = useApi<{ total: number; cards: CardDto[]; pageSize: number }>(url, { ttl: 5000 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const active = functions.length + levels.length + status.length + difficulty.length + (rankMin || rankMax ? 1 : 0);
  const reviewHref = `/review?f=${encodeURIComponent(JSON.stringify({ ...filter, q: undefined, status: filter.status?.length ? filter.status : ["due", "new"] }))}&n=20`;

  const remove = useCallback(async () => {
    if (!toDelete) return;
    try {
      await api(`/api/cards/${toDelete.id}`, { method: "DELETE" });
      toast("Carte supprimée", "success");
      invalidate("/api/"); setToDelete(null); reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Erreur", "error"); }
  }, [toDelete, toast, reload]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans mes cartes…" aria-label="Rechercher dans mes cartes" className="pl-10" />
        </div>
        <Select aria-label="Trier par" value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto max-w-56">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Button variant={showFilters ? "primary" : "secondary"} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><Filter className="size-4" /> Filtres{active > 0 && ` (${active})`}</Button>
        {allowCreate && <Button onClick={() => setEditor({ open: true, card: null })}><Plus className="size-4" /> Nouvelle carte</Button>}
      </div>

      {showFilters && (
        <Card className="anim-up space-y-4">
          <div className="space-y-2"><h3 className="text-sm font-semibold">Fonction grammaticale</h3>
            <div className="flex flex-wrap gap-2">{(Object.keys(FUNCTION_LABEL) as FunctionKey[]).map((k) => <Chip key={k} active={functions.includes(k)} onClick={() => setFunctions(toggle(functions, k))}>{FUNCTION_LABEL[k]}</Chip>)}</div></div>
          <div className="space-y-2"><h3 className="text-sm font-semibold">Niveau</h3>
            <div className="flex flex-wrap gap-2">{LEVELS.map((l) => <Chip key={l} active={levels.includes(l)} onClick={() => setLevels(toggle(levels, l))}>{l}</Chip>)}</div></div>
          <div className="space-y-2"><h3 className="text-sm font-semibold">Statut</h3>
            <div className="flex flex-wrap gap-2">
              {(["new", "learning", "due", "mastered"] as const).map((s) => <Chip key={s} active={status.includes(s)} onClick={() => setStatus(toggle(status, s))}>{{ new: "Nouvelles", learning: "En apprentissage", due: "À revoir", mastered: "Maîtrisées" }[s]}</Chip>)}
              {(["easy", "medium", "hard"] as const).map((s) => <Chip key={s} active={difficulty.includes(s)} onClick={() => setDifficulty(toggle(difficulty, s))}>{{ easy: "Facile", medium: "Moyen", hard: "Difficile" }[s]}</Chip>)}
            </div></div>
          <div className="space-y-2"><h3 className="text-sm font-semibold">Rang de fréquence</h3>
            <div className="flex flex-wrap items-center gap-2">
              {RANKS.map(([a, b]) => <Chip key={a} active={rankMin === a && rankMax === b} onClick={() => { if (rankMin === a && rankMax === b) { setRankMin(undefined); setRankMax(undefined); } else { setRankMin(a); setRankMax(b); } }}>{a}–{b}</Chip>)}
              <Input type="number" aria-label="Rang min" placeholder="min" value={rankMin ?? ""} onChange={(e) => setRankMin(e.target.value ? Number(e.target.value) : undefined)} className="!h-10 w-24" />
              <span>→</span>
              <Input type="number" aria-label="Rang max" placeholder="max" value={rankMax ?? ""} onChange={(e) => setRankMax(e.target.value ? Number(e.target.value) : undefined)} className="!h-10 w-24" />
            </div></div>
          <div className="flex justify-between"><Button variant="ghost" size="sm" onClick={() => { setFunctions([]); setLevels([]); setStatus([]); setDifficulty([]); setRankMin(undefined); setRankMax(undefined); }}>Réinitialiser</Button>
            <Link href={reviewHref}><Button size="sm"><Play className="size-4" /> Réviser cette sélection</Button></Link></div>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted" aria-live="polite">
        <span>{data ? `${data.total} carte${data.total > 1 ? "s" : ""}` : "Chargement…"}</span>
        {data && data.total > 0 && !showFilters && <Link href={reviewHref} className="text-brand hover:underline">Réviser cette sélection</Link>}
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : data && data.cards.length === 0 ? (
        <EmptyState icon="🗂️" title="Aucune carte" action={allowCreate ? <Button onClick={() => setEditor({ open: true })}><Plus className="size-4" /> Créer une carte</Button> : undefined}>{emptyHint ?? "Aucune carte ne correspond à votre recherche."}</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {data?.cards.map((c) => {
            const v = c.vocabulary;
            const b = BUCKET[c.bucket];
            return (
              <li key={c.id}>
                <Card className="flex items-center gap-3 !p-3.5 sm:!p-4">
                  {v.rank && <span className="hidden w-12 shrink-0 text-right text-xs font-medium tabular-nums text-muted sm:block">#{v.rank}</span>}
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditor({ open: true, card: c })} aria-label={`Ouvrir ${v.word}`}>
                    <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-lg font-semibold" lang="en">{v.word}</span>{v.ipa && <span className="text-sm text-muted">/{v.ipa}/</span>}</div>
                    <div className="truncate text-sm text-muted">{v.translation}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge>{v.category}</Badge><Badge tone={LEVEL_TONE[v.level]}>{v.level}</Badge><Badge tone={b.tone}>{b.label}</Badge>{c.origin === "MISTAKE" && <Badge tone="warn">Erreur</Badge>}{c.mastered && <Badge tone="good">Maîtrisée</Badge>}
                      {c.decks.slice(0, 1).map((d) => <Badge key={d.id} tone="brand">{d.name}</Badge>)}</div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <SpeakButton text={v.word} compact label="Listen" />
                    <button onClick={() => setEditor({ open: true, card: c })} aria-label={`Modifier ${v.word}`} className="hidden size-11 items-center justify-center rounded-xl hover:bg-surface-2 sm:inline-flex"><Pencil className="size-4" /></button>
                    <button onClick={() => setToDelete(c)} aria-label={`Supprimer ${v.word}`} className="inline-flex size-11 items-center justify-center rounded-xl text-danger hover:bg-danger-soft"><Trash2 className="size-4" /></button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Page précédente"><ChevronLeft className="size-4" /></Button>
          <span className="text-sm tabular-nums">{page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Page suivante"><ChevronRight className="size-4" /></Button>
        </nav>
      )}

      <CardEditor open={editor.open} card={editor.card} defaultDeckId={deckId} onClose={() => setEditor({ open: false })} onSaved={reload} />
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Supprimer cette carte ?">
        <p className="text-sm text-muted">« {toDelete?.vocabulary.word} » et son historique de révisions seront supprimés de vos cartes.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setToDelete(null)}>Annuler</Button><Button variant="danger" onClick={remove}>Supprimer</Button></div>
      </Modal>
    </div>
  );
}
