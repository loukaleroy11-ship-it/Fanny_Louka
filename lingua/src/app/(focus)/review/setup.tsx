"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Button, Card, Chip, Input } from "@/components/ui";
import { api, useDebounced } from "@/lib/client";
import { FUNCTION_LABEL, type FunctionKey } from "@/lib/labels";
import type { CardFilter } from "@/lib/filters";

export type Order = "smart" | "random" | "rank";
export interface Setup { filter: CardFilter; limit: number; order: Order }

export const EMPTY_FILTER: CardFilter = { scope: [], status: ["due", "new"], difficulty: [], functions: [], levels: [], tag: undefined, q: undefined, ids: undefined, rankMin: undefined, rankMax: undefined, deckId: undefined };

const COUNTS = [5, 10, 20, 30, 50, 100];
const RANKS: [number, number][] = [[1, 50], [51, 100], [101, 200], [201, 300], [301, 400], [401, 500]];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function SetupScreen({ initial, onStart, starting }: { initial: Setup; onStart: (s: Setup) => void; starting: boolean }) {
  const [filter, setFilter] = useState<CardFilter>(initial.filter);
  const [limit, setLimit] = useState(initial.limit);
  const [custom, setCustom] = useState(!COUNTS.includes(initial.limit));
  const [order, setOrder] = useState<Order>(initial.order);
  const [preview, setPreview] = useState<{ matching: number; due: number; new: number } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const debounced = useDebounced(filter, 250);
  const rangeKey = RANKS.find(([a, b]) => filter.rankMin === a && filter.rankMax === b);
  const [customRank, setCustomRank] = useState(!!(filter.rankMin || filter.rankMax) && !rangeKey);

  useEffect(() => {
    let live = true;
    setPreviewError("");
    api<{ matching: number; due: number; new: number }>("/api/review/preview", { method: "POST", json: { filter: debounced } })
      .then((r) => live && setPreview(r))
      .catch((e) => live && setPreviewError(e instanceof Error ? e.message : "Erreur"));
    return () => { live = false; };
  }, [debounced]);

  const set = <K extends keyof CardFilter>(k: K, v: CardFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const effective = preview ? Math.min(limit, preview.matching) : 0;
  const group = "space-y-2";
  const title = "text-sm font-semibold";

  return (
    <div className="space-y-5 anim-up">
      <div>
        <h1 className="text-2xl font-semibold">Réviser</h1>
        <p className="text-sm text-muted">Choisissez précisément ce que vous voulez travailler. Les filtres d&apos;un même groupe s&apos;additionnent (OU), les groupes se combinent (ET).</p>
      </div>

      <Card className="space-y-6">
        <section className={group}>
          <h2 className={title}>Combien de cartes ?</h2>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((n) => <Chip key={n} active={!custom && limit === n} onClick={() => { setCustom(false); setLimit(n); }}>{n}</Chip>)}
            <Chip active={custom} onClick={() => setCustom(true)}>Custom</Chip>
            {custom && <Input aria-label="Nombre de cartes" type="number" inputMode="numeric" min={1} max={500} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="!h-10 w-24" />}
          </div>
        </section>

        <section className={group}>
          <h2 className={title}>Quelles cartes ?</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Source des cartes">
            <Chip active={filter.scope.includes("mine")} onClick={() => set("scope", toggle(filter.scope, "mine"))}>Mes cartes</Chip>
            <Chip active={filter.scope.includes("mistakes")} onClick={() => set("scope", toggle(filter.scope, "mistakes"))}>Mes erreurs</Chip>
            <Chip active={filter.scope.includes("common500")} onClick={() => set("scope", toggle(filter.scope, "common500"))}>500 mots les plus utilisés</Chip>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Statut des cartes">
            <Chip active={filter.status.includes("due")} onClick={() => set("status", toggle(filter.status, "due"))}>Cartes à revoir</Chip>
            <Chip active={filter.status.includes("new")} onClick={() => set("status", toggle(filter.status, "new"))}>Cartes jamais vues</Chip>
            <Chip active={filter.difficulty.includes("hard")} onClick={() => set("difficulty", toggle(filter.difficulty, "hard"))}>Cartes difficiles</Chip>
          </div>
          <p className="text-xs text-muted">Sans aucun statut sélectionné, toutes les cartes correspondantes sont éligibles.</p>
        </section>

        <section className={group}>
          <h2 className={title}>Rang de fréquence <span className="font-normal text-muted">(mots classés)</span></h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Plage de rang">
            <Chip active={!filter.rankMin && !filter.rankMax && !customRank} onClick={() => { setCustomRank(false); setFilter((f) => ({ ...f, rankMin: undefined, rankMax: undefined })); }}>Tous</Chip>
            {RANKS.map(([a, b]) => (
              <Chip key={a} active={!customRank && filter.rankMin === a && filter.rankMax === b} onClick={() => { setCustomRank(false); setFilter((f) => ({ ...f, rankMin: a, rankMax: b })); }}>{a} → {b}</Chip>
            ))}
            <Chip active={customRank} onClick={() => setCustomRank(true)}>Custom</Chip>
          </div>
          {customRank && (
            <div className="flex items-center gap-2 text-sm">
              <Input aria-label="Rang minimum" type="number" inputMode="numeric" min={1} placeholder="120" value={filter.rankMin ?? ""} onChange={(e) => set("rankMin", e.target.value ? Number(e.target.value) : undefined)} className="!h-10 w-28" />
              <span>→</span>
              <Input aria-label="Rang maximum" type="number" inputMode="numeric" min={1} placeholder="250" value={filter.rankMax ?? ""} onChange={(e) => set("rankMax", e.target.value ? Number(e.target.value) : undefined)} className="!h-10 w-28" />
            </div>
          )}
        </section>

        <section className={group}>
          <h2 className={title}>Fonction grammaticale</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Fonction grammaticale">
            {(Object.keys(FUNCTION_LABEL) as FunctionKey[]).filter((k) => k !== "interjection").map((k) => (
              <Chip key={k} active={filter.functions.includes(k)} onClick={() => set("functions", toggle(filter.functions, k))}>{FUNCTION_LABEL[k]}</Chip>
            ))}
          </div>
        </section>

        <section className={group}>
          <h2 className={title}>Niveau CECRL</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Niveau">
            {LEVELS.map((l) => <Chip key={l} active={filter.levels.includes(l)} onClick={() => set("levels", toggle(filter.levels, l))}>{l}</Chip>)}
          </div>
        </section>

        <section className={group}>
          <h2 className={title}>Ordre</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ordre">
            <Chip active={order === "smart"} onClick={() => setOrder("smart")}>Intelligent (dues d&apos;abord)</Chip>
            <Chip active={order === "rank"} onClick={() => setOrder("rank")}>Par fréquence</Chip>
            <Chip active={order === "random"} onClick={() => setOrder("random")}>Aléatoire</Chip>
          </div>
        </section>
      </Card>

      <div className="sticky bottom-3 z-10">
        <Card className="flex flex-wrap items-center justify-between gap-3 !p-4 shadow-lg">
          <div className="text-sm" aria-live="polite">
            {previewError ? <span className="text-danger">{previewError}</span> : preview ? (
              <><b className="text-base">{preview.matching}</b> cartes correspondent <span className="text-muted">· {preview.due} à revoir · {preview.new} nouvelles</span></>
            ) : <span className="text-muted">Calcul…</span>}
          </div>
          <Button size="lg" disabled={!preview || preview.matching === 0} loading={starting} onClick={() => onStart({ filter, limit, order })}>
            <Play className="size-4" /> Commencer{preview && preview.matching > 0 ? ` (${effective})` : ""}
          </Button>
        </Card>
      </div>
    </div>
  );
}
