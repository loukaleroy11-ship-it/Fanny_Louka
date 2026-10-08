"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw, Trophy } from "lucide-react";
import { Button, Card, ErrorState, Progress, Chip } from "@/components/ui";
import { Ring } from "@/components/charts";
import { CardFaces } from "@/components/flashcard";
import { useToast, useUser } from "@/components/providers";
import { ApiClientError, api, invalidate } from "@/lib/client";
import { speak } from "@/lib/speech";
import type { CardDto } from "@/lib/serialize";
import { EMPTY_FILTER, SetupScreen, type Order, type Setup } from "./setup";

type QCard = CardDto & { intervals: Record<number, string> };
interface Summary { items: number; correct: number; accuracy: number; durationSec: number; again: number; levelChanged: { from: string; to: string } | null; xp: number }

function presetSetup(params: URLSearchParams): Setup {
  const f = { ...EMPTY_FILTER };
  const n = Number(params.get("n"));
  switch (params.get("preset")) {
    case "due": f.status = ["due"]; break;
    case "new": f.status = ["new"]; break;
    case "hard": f.status = []; f.difficulty = ["hard"]; break;
    case "mistakes": f.scope = ["mistakes"]; f.status = ["due", "new"]; break;
    case "mine": f.scope = ["mine"]; f.status = ["due", "new"]; break;
    case "common500": f.scope = ["common500"]; f.status = ["due", "new"]; break;
  }
  const raw = params.get("f");
  if (raw) { try { Object.assign(f, JSON.parse(raw)); } catch { /* ignore bad filter */ } }
  if (params.get("deck")) { f.deckId = params.get("deck")!; f.status = ["due", "new"]; }
  const order: Order = params.get("preset") === "new" ? "rank" : "smart";
  return { filter: f, limit: n > 0 ? Math.min(500, n) : 20, order };
}

export function ReviewApp() {
  const params = useSearchParams();
  const toast = useToast();
  const { user, update, refresh } = useUser();
  const initial = useRef(presetSetup(params)).current;
  const [phase, setPhase] = useState<"setup" | "loading" | "session" | "summary">(params.get("go") === "1" ? "loading" : "setup");
  const [setup, setSetup] = useState(initial);
  const [queue, setQueue] = useState<QCard[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);
  const stats = useRef({ ok: 0, xp: 0 });

  useEffect(() => { try { setAutoplay(localStorage.getItem("lingua-autoplay") === "1"); } catch { /* ignore */ } }, []);

  const start = useCallback(async (s: Setup) => {
    setSetup(s);
    setPhase("loading");
    setError("");
    try {
      const r = await api<{ sessionId: string; cards: QCard[]; total: number }>("/api/review/queue", { method: "POST", json: s });
      setQueue(r.cards); setSessionId(r.sessionId); setTotal(r.cards.length); setDone(0); setFlipped(false);
      stats.current = { ok: 0, xp: 0 };
      shownAt.current = Date.now();
      setPhase("session");
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) { toast("Aucune carte ne correspond à ces filtres.", "info"); setPhase("setup"); }
      else { setError(e instanceof Error ? e.message : "Erreur"); setPhase("setup"); }
    }
  }, [toast]);

  useEffect(() => { if (params.get("go") === "1") void start(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = queue[0];

  // Autoplay the English word when a new card appears (if enabled)
  useEffect(() => {
    if (phase !== "session" || !card || !autoplay || reverse || card.origin === "MISTAKE") return;
    void speak(card.vocabulary.word, { accent: user.accent, gender: user.voiceGender, rate: user.speechRate });
  }, [card?.id, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(async () => {
    try {
      const r = await api<Omit<Summary, "xp">>("/api/review/finish", { method: "POST", json: { sessionId } });
      setSummary({ ...r, xp: stats.current.xp });
      if (r.levelChanged) toast(`Niveau ${r.levelChanged.to} atteint ! 🎉`, "reward");
      await refresh();
    } catch { setSummary({ items: done, correct: stats.current.ok, accuracy: done ? stats.current.ok / done : 0, durationSec: 0, again: 0, levelChanged: null, xp: stats.current.xp }); }
    invalidate("/api/");
    setPhase("summary");
  }, [sessionId, toast, refresh, done]);

  const rate = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    if (!card || busy || !flipped) return;
    setBusy(true);
    const durationMs = Date.now() - shownAt.current;
    try {
      const r = await api<{ requeue: boolean; intervals: Record<number, string>; card: { due: string; state: number; reps: number; lapses: number }; progress: { xpGained: number; unlocked: { name: string; icon: string }[] } }>(
        "/api/review/answer", { method: "POST", json: { flashcardId: card.id, rating, durationMs, sessionId } });
      stats.current.xp += r.progress.xpGained;
      if (rating >= 3) stats.current.ok++;
      r.progress.unlocked.forEach((u) => toast(`${u.icon} Badge débloqué : ${u.name}`, "reward"));
      const rest = queue.slice(1);
      // Anki-style: cards in (re)learning come back later in the same session
      const next = r.requeue ? [...rest, { ...card, intervals: r.intervals, reps: r.card.reps, lapses: r.card.lapses }] : rest;
      setDone((d) => d + 1);
      setFlipped(false);
      shownAt.current = Date.now();
      setQueue(next);
      if (next.length === 0) await finish();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur d'enregistrement", "error");
    }
    setBusy(false);
  }, [card, busy, flipped, queue, sessionId, toast, finish]);

  // Keyboard: Space = flip, 1-4 = rate
  useEffect(() => {
    if (phase !== "session") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === " " && t.tagName !== "BUTTON") { e.preventDefault(); setFlipped((f) => !f); }
      else if (flipped && ["1", "2", "3", "4"].includes(e.key)) void rate(Number(e.key) as 1 | 2 | 3 | 4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, flipped, rate]);

  if (phase === "setup") return <>{error && <ErrorState message={error} />}<SetupScreen initial={setup} onStart={start} starting={false} /></>;
  if (phase === "loading") return <div className="my-auto text-center"><div className="mx-auto size-10 animate-spin rounded-full border-4 border-brand border-t-transparent" /><p className="mt-4 text-muted">Préparation de la session…</p></div>;

  if (phase === "summary" && summary)
    return (
      <div className="space-y-4 anim-up">
        <Card className="space-y-4 text-center">
          <Trophy className="mx-auto size-10 text-warn" aria-hidden />
          <h1 className="text-2xl font-semibold">Session terminée !</h1>
          <div className="flex justify-center"><Ring value={summary.accuracy} size={140} stroke={12} color={summary.accuracy >= 0.7 ? "var(--accent)" : "var(--warn)"}><div><div className="text-3xl font-semibold">{Math.round(summary.accuracy * 100)}%</div><div className="text-xs text-muted">réussite</div></div></Ring></div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Cartes</dt><dd className="text-xl font-semibold">{summary.items}</dd></div>
            <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">À revoir</dt><dd className="text-xl font-semibold">{summary.again}</dd></div>
            <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">XP</dt><dd className="text-xl font-semibold">+{summary.xp}</dd></div>
          </dl>
          {summary.levelChanged && <p className="rounded-xl bg-brand-soft p-3 text-sm font-medium text-brand">🎉 Niveau estimé : {summary.levelChanged.from} → {summary.levelChanged.to}</p>}
        </Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => { setPhase("setup"); setSummary(null); }}><RotateCcw className="size-4" /> Nouvelle session</Button>
          <Link href="/dashboard" className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface font-medium hover:bg-surface-2">Retour au dashboard</Link>
        </div>
      </div>
    );

  if (!card) return null;
  const labels: [1 | 2 | 3 | 4, string, string][] = [
    [1, "Again", "bg-danger-soft text-danger border-danger/30"],
    [2, "Hard", "bg-warn-soft text-warn border-warn/30"],
    [3, "Good", "bg-accent-soft text-accent border-accent/30"],
    [4, "Easy", "bg-brand-soft text-brand border-brand/30"],
  ];
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="tabular-nums" aria-live="polite">{Math.min(done + 1, total)} / {total}{queue.length > total - done && " (+ rappels)"}</span>
          <div className="flex items-center gap-2">
            <Chip className="!h-9 !text-xs" active={user.accent === "UK"} onClick={() => void update({ accent: user.accent === "UK" ? "US" : "UK" })} title="Accent de prononciation">{user.accent === "UK" ? "🇬🇧 UK" : "🇺🇸 US"}</Chip>
            <Chip className="!h-9 !text-xs" active={reverse} onClick={() => { setReverse(!reverse); setFlipped(false); }} title="Afficher le français d'abord">FR→EN</Chip>
            <Chip className="!h-9 !text-xs" active={autoplay} onClick={() => { setAutoplay(!autoplay); try { localStorage.setItem("lingua-autoplay", !autoplay ? "1" : "0"); } catch { /* ignore */ } }} title="Lire automatiquement">🔊 auto</Chip>
          </div>
        </div>
        <Progress value={done / Math.max(1, total)} label="Progression de la session" />
      </div>

      <div key={card.id} className="anim-up">
        <CardFaces card={card} flipped={flipped} reverse={reverse} onFlip={() => setFlipped((f) => !f)} />
      </div>

      <div className="mt-auto pb-2">
        {!flipped ? (
          <Button size="lg" variant="secondary" className="w-full" onClick={() => setFlipped(true)}>Afficher la réponse <kbd className="ml-1 rounded bg-surface px-1.5 text-xs text-muted">Espace</kbd></Button>
        ) : (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Évaluez votre réponse">
            {labels.map(([r, label, cls]) => (
              <button key={r} onClick={() => void rate(r)} disabled={busy} className={clsx("flex min-h-16 flex-col items-center justify-center rounded-2xl border px-1 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-60", cls)}>
                <span>{label}</span>
                <span className="text-[11px] font-normal opacity-80">{card.intervals[r]}</span>
                <kbd className="hidden text-[10px] opacity-60 sm:block">{r}</kbd>
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-muted"><Check className="size-3" aria-hidden /> Les cartes ratées reviennent dans la session</p>
      </div>
    </div>
  );
}
