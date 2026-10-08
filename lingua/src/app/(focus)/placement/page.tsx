"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { Button, Card, Progress, Skeleton, ErrorState, Badge } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { SECTION_LABEL, type PlacementQuestion, type PlacementSection } from "@/content/placement";
import type { DailyPlan } from "@/lib/plan";

type Q = Omit<PlacementQuestion, "answer" | "explain">;
interface Result {
  estimatedLevel: string;
  sections: { section: PlacementSection; correct: number; total: number; level: string }[];
  skills: { area: string; level: string }[];
}

export default function PlacementPage() {
  const { data, error, loading, reload } = useApi<{ questions: Q[] }>("/api/placement", { ttl: 60_000 });
  const [phase, setPhase] = useState<"intro" | "quiz" | "sending" | "result">("intro");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [err, setErr] = useState("");
  const qs = data?.questions ?? [];
  const q = qs[i];

  async function submit(final: Record<string, string>) {
    setPhase("sending");
    try {
      const r = await api<Result>("/api/placement", { method: "POST", json: { answers: final } });
      setResult(r);
      setPlan(await api<DailyPlan>("/api/plan"));
      setPhase("result");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      setPhase("quiz");
    }
  }
  function pick(opt: string) {
    const next = { ...answers, [q.id]: opt };
    setAnswers(next);
    if (i + 1 < qs.length) setI(i + 1);
    else void submit(next);
  }

  useEffect(() => {
    if (phase !== "quiz" || !q) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) pick(q.options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40" /></div>;

  if (phase === "intro")
    return (
      <Card className="anim-up my-auto space-y-5 text-center">
        <div className="text-5xl">🎯</div>
        <h1 className="text-2xl font-semibold">Test de niveau</h1>
        <p className="mx-auto max-w-md text-muted">{qs.length} questions rapides (~6 min) sur le vocabulaire, la grammaire, la conjugaison et la compréhension. Répondez au mieux — si vous ne savez pas, choisissez « Je ne sais pas » plutôt que de deviner.</p>
        <div className="flex flex-wrap justify-center gap-2">{(Object.keys(SECTION_LABEL) as PlacementSection[]).map((s) => <Badge key={s} tone="brand">{SECTION_LABEL[s]}</Badge>)}</div>
        <Button size="lg" onClick={() => setPhase("quiz")}>Commencer <ArrowRight className="size-4" /></Button>
        <p><Link href="/dashboard" className="text-sm text-muted hover:underline">Passer pour l&apos;instant (niveau A1 par défaut)</Link></p>
      </Card>
    );

  if (phase === "sending") return <div className="my-auto text-center"><div className="mx-auto size-10 animate-spin rounded-full border-4 border-brand border-t-transparent" /><p className="mt-4 text-muted">Analyse de vos réponses…</p></div>;

  if (phase === "result" && result)
    return (
      <div className="space-y-5 anim-up">
        <Card className="text-center">
          <p className="text-sm text-muted">Estimated level</p>
          <p className="my-2 text-6xl font-semibold text-brand" data-testid="estimated-level">{result.estimatedLevel}</p>
          <p className="text-sm text-muted">Votre niveau évoluera automatiquement avec vos performances.</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Détail par section</h2>
          <ul className="space-y-3">
            {result.sections.map((s) => (
              <li key={s.section} className="space-y-1">
                <div className="flex justify-between text-sm"><span className="font-medium">{SECTION_LABEL[s.section]}</span><span className="text-muted">{s.correct}/{s.total} · <b className="text-text">{s.level}</b></span></div>
                <Progress value={s.correct / s.total} label={SECTION_LABEL[s.section]} tone={s.correct / s.total > 0.6 ? "good" : "warn"} />
              </li>
            ))}
          </ul>
        </Card>
        {plan && (
          <Card>
            <h2 className="mb-1 font-semibold">Votre programme personnalisé</h2>
            <p className="mb-3 text-sm text-muted">Généré à partir de votre niveau, de vos erreurs et de votre temps disponible.</p>
            <ol className="space-y-2">{plan.items.map((it, n) => <li key={it.id} className="flex items-center gap-3 text-sm"><span className="text-lg">{it.icon}</span><span className="flex-1">{n + 1}. {it.title}</span></li>)}</ol>
          </Card>
        )}
        <Link href="/dashboard" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-ink hover:brightness-110"><CheckCircle2 className="size-5" /> Commencer mon apprentissage</Link>
      </div>
    );

  if (!q) return null;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted"><span>{SECTION_LABEL[q.section]}</span><span className="tabular-nums">{i + 1} / {qs.length}</span></div>
        <Progress value={i / qs.length} label="Progression du test" />
      </div>
      {q.passage && <Card className="bg-surface-2 !shadow-none"><p className="text-sm leading-relaxed">{q.passage}</p></Card>}
      <Card key={q.id} className="anim-up space-y-5">
        <h1 className="text-xl font-semibold leading-snug">{q.prompt}</h1>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <div className="grid gap-2.5" role="group" aria-label="Réponses">
          {q.options.map((o, n) => (
            <button key={o} onClick={() => pick(o)} className={clsx("flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-4 text-left text-base transition hover:border-brand hover:bg-brand-soft active:scale-[0.99]")}>
              <kbd className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-muted">{n + 1}</kbd>{o}
            </button>
          ))}
          <button onClick={() => pick("")} className="min-h-12 rounded-xl px-4 text-sm text-muted hover:bg-surface-2">Je ne sais pas</button>
        </div>
      </Card>
    </div>
  );
}
