"use client";
import { useState } from "react";
import { BookOpenCheck, Brain, Clock, Flame, MessageCircle, Target, TriangleAlert, Trophy, CheckCircle2 } from "lucide-react";
import { Card, Chip, ErrorState, PageHeader, Skeleton, Stat } from "@/components/ui";
import { BarChart, HBar, LineChart } from "@/components/charts";
import { useApi } from "@/lib/client";
import type { getStats } from "@/lib/stats";

type Stats = Awaited<ReturnType<typeof getStats>>;

export function StatsView() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<Stats>(`/api/stats?days=${days}`, { ttl: 10_000 });
  const label = (d: string) => d.slice(5);
  return (
    <div className="space-y-6">
      <PageHeader title="Statistiques" subtitle="Votre apprentissage en chiffres." actions={<div className="flex gap-2">{[7, 30, 90].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d} j</Chip>)}</div>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<BookOpenCheck className="size-4" />} label="Mots appris" value={data.totals.learned} sub={`sur ${data.totals.totalCards} cartes`} />
            <Stat icon={<Trophy className="size-4" />} label="Mots maîtrisés" value={data.totals.mastered} sub="stabilité ≥ 21 jours" />
            <Stat icon={<Brain className="size-4" />} label="Cartes révisées" value={data.totals.reviews} sub="révisions au total" />
            <Stat icon={<TriangleAlert className="size-4" />} label="Cartes difficiles" value={data.totals.hard} />
            <Stat icon={<CheckCircle2 className="size-4" />} label="Taux de réussite" value={data.totals.successRate === null ? "—" : `${Math.round(data.totals.successRate * 100)}%`} sub="30 derniers jours" />
            <Stat icon={<Clock className="size-4" />} label="Temps d'apprentissage" value={`${data.totals.minutes} min`} />
            <Stat icon={<MessageCircle className="size-4" />} label="Conversations" value={data.totals.conversations} sub={`${data.totals.wordsSpoken} mots prononcés`} />
            <Stat icon={<Target className="size-4" />} label="Erreurs" value={data.totals.mistakes} />
            <Stat icon={<Flame className="size-4 text-orange-500" />} label="Série actuelle" value={`${data.totals.streak} j`} sub={`record : ${data.totals.longestStreak} j`} />
            <Stat label="Niveau" value={data.level.label} sub={`score ${data.level.overall.toFixed(1)} / 6`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><h2 className="mb-3 font-semibold">Révisions par jour</h2><BarChart data={data.series.map((s) => ({ label: label(s.date), value: s.cards }))} /></Card>
            <Card><h2 className="mb-3 font-semibold">Nombre de mots appris</h2><LineChart data={data.cumulative.map((s) => ({ label: label(s.date), value: s.value }))} color="var(--accent)" /></Card>
            <Card><h2 className="mb-3 font-semibold">Temps passé (minutes)</h2><BarChart data={data.series.map((s) => ({ label: label(s.date), value: s.minutes }))} color="var(--brand)" unit=" min" /></Card>
            <Card><h2 className="mb-3 font-semibold">Erreurs par jour</h2><BarChart data={data.series.map((s) => ({ label: label(s.date), value: s.mistakes }))} color="var(--warn)" /></Card>
            <Card><h2 className="mb-3 font-semibold">Taux de réussite des révisions</h2><LineChart data={data.series.map((s) => ({ label: label(s.date), value: s.accuracy === null ? null : Math.round(s.accuracy * 100) }))} yMax={100} unit="%" color="var(--accent)" /></Card>
            <Card><h2 className="mb-3 font-semibold">Erreurs les plus fréquentes</h2>
              {data.topMistakes.length === 0 ? <p className="text-sm text-muted">Aucune erreur enregistrée.</p> : <div className="space-y-3">{data.topMistakes.map((m) => <HBar key={m.label} label={m.label} value={m.count} max={data.topMistakes[0].count} right={`${m.count} mistakes`} tone="warn" />)}</div>}</Card>
          </div>
        </>
      )}
    </div>
  );
}
