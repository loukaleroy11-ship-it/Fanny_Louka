"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { Ring } from "@/components/charts";
import { useApi } from "@/lib/client";

interface P {
  overall: { value: number; label: string; level: string; nextLevel: string; progressToNext: number };
  skills: { area: string; label: string; value: number; level: string; evidence: number }[];
  gaps: { area: string; label: string; level: string }[];
  grammar: { slug: string; name: string; mastery: number; mistakes: number; attempts: number; priority: number }[];
  recurring: { slug: string; name: string; mistakes: number; priority: number; lessonSlug: string | null }[];
}
const LESSONS = ["present-simple", "present-continuous", "past-simple", "present-perfect", "future-forms"];
const BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function ProgressView() {
  const { data, error, loading, reload } = useApi<P>("/api/progress", { ttl: 10_000 });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;
  return (
    <div className="space-y-6">
      <PageHeader title="Progression" subtitle="Votre niveau estimé, compétence par compétence, et ce qu'il faut travailler pour passer au suivant." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted">Overall</p>
          <Ring value={data.overall.progressToNext} size={150} stroke={13} label={`Progression vers ${data.overall.nextLevel}`}><div><div className="text-4xl font-semibold">{data.overall.label}</div><div className="text-xs text-muted">→ {data.overall.nextLevel}</div></div></Ring>
          <p className="text-sm text-muted">{Math.round(data.overall.progressToNext * 100)} % du chemin vers {data.overall.nextLevel}</p>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="mb-4 font-semibold">Compétences</h2>
          <ul className="space-y-4">
            {data.skills.map((s) => (
              <li key={s.area}>
                <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{s.label}</span><span><b>{s.level}</b> <span className="text-xs text-muted">{s.evidence === 0 ? "(estimation initiale)" : `${s.evidence} observations`}</span></span></div>
                <div className="relative h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${s.label} : ${s.level}`}>
                  <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(s.value / 6) * 100}%` }} />
                  {[1, 2, 3, 4, 5].map((n) => <span key={n} className="absolute top-0 h-full w-px bg-bg/70" style={{ left: `${(n / 6) * 100}%` }} />)}
                </div>
                <div className="mt-0.5 flex justify-between px-0.5 text-[10px] text-muted" aria-hidden>{BANDS.map((b) => <span key={b}>{b}</span>)}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Reading provient du test de niveau ; Listening des exercices « Listen and type » ; Speaking et Writing des conversations ; Vocabulary des flashcards ; Grammar des exercices.</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Lacunes identifiées</h2>
        <div className="flex flex-wrap gap-2">{data.gaps.map((g) => <Badge key={g.area} tone="warn" className="!py-1.5 !text-sm">{g.label} ({g.level})</Badge>)}</div>
        {data.recurring.length > 0 && <ul className="mt-4 space-y-2">{data.recurring.map((r) => (
          <li key={r.slug} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <span><b>{r.name}</b> — {r.mistakes} erreurs <span className="text-muted">(priorité {r.priority.toFixed(1)})</span></span>
            {LESSONS.includes(r.slug) ? <Link href={`/grammar/${r.slug}`} className="inline-flex items-center gap-1 text-brand hover:underline">Réviser la leçon <ArrowRight className="size-4" /></Link> : <Link href="/mistakes" className="text-brand hover:underline">Voir les erreurs</Link>}
          </li>))}</ul>}
        {data.recurring.length === 0 && <p className="mt-3 text-sm text-muted">Pas encore d&apos;erreur récurrente. Plus vous parlez et faites d&apos;exercices, plus l&apos;analyse est précise.</p>}
      </Card>

      {data.grammar.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Maîtrise grammaticale</h2>
          <ul className="grid gap-3 sm:grid-cols-2">{data.grammar.map((g) => (
            <li key={g.slug} className="space-y-1"><div className="flex justify-between text-sm"><span>{g.name}</span><span className="text-muted">{Math.round(g.mastery * 100)} %</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${g.mastery > 0.7 ? "bg-accent" : g.mastery > 0.45 ? "bg-warn" : "bg-danger"}`} style={{ width: `${g.mastery * 100}%` }} /></div></li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}
