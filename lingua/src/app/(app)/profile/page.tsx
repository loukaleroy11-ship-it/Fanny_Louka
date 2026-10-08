import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getStats } from "@/lib/stats";
import { getEstimates } from "@/lib/skills";
import { levelLabel } from "@/lib/levels";
import { db } from "@/lib/db";
import { achievementByCode, ACHIEVEMENTS } from "@/lib/achievements";
import { ProfileForm } from "./profile-form";
import { Badge, Card, PageHeader, Progress, Stat } from "@/components/ui";
import { HBar } from "@/components/charts";

export const metadata: Metadata = { title: "Profil" };

export default async function Page() {
  const user = await requireUser();
  const [stats, est, unlocked] = await Promise.all([getStats(user.id, 30), getEstimates(user.id), db.achievement.findMany({ where: { userId: user.id } })]);
  const have = new Set(unlocked.map((a) => a.code));
  return (
    <div className="space-y-6">
      <PageHeader title={user.name} subtitle={user.email} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Niveau d'anglais" value={levelLabel(est.overall)} sub={`déclaré : ${user.level}`} />
        <Stat label="Mots appris" value={stats.totals.learned} />
        <Stat label="Cartes révisées" value={stats.totals.reviews} />
        <Stat label="Temps d'apprentissage" value={`${stats.totals.minutes} min`} />
        <Stat label="Streak" value={`🔥 ${stats.totals.streak}`} sub={`record ${stats.totals.longestStreak}`} />
        <Stat label="Objectif" value={<span className="text-base">{user.goal}</span>} />
        <Stat label="Temps quotidien" value={`${user.dailyMinutes} min`} />
        <Stat label="XP" value={user.xp} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Progression par compétence</h2>
          <div className="space-y-3">{est.list.map((e) => <div key={e.area} className="space-y-1"><div className="flex justify-between text-sm"><span>{e.area[0] + e.area.slice(1).toLowerCase()}</span><b>{levelLabel(e.value)}</b></div><Progress value={e.value / 6} label={e.area} /></div>)}</div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Erreurs fréquentes</h2>
          {stats.topMistakes.length === 0 ? <p className="text-sm text-muted">Aucune pour l&apos;instant.</p> : <div className="space-y-3">{stats.topMistakes.slice(0, 5).map((m) => <HBar key={m.label} label={m.label} value={m.count} max={stats.topMistakes[0].count} right={`${m.count} mistakes`} tone="warn" />)}</div>}
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Badges</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ACHIEVEMENTS.map((a) => (
          <li key={a.code} className={`flex items-center gap-3 rounded-xl border border-border p-3 ${have.has(a.code) ? "" : "opacity-45 grayscale"}`}>
            <span className="text-2xl" aria-hidden>{achievementByCode(a.code)?.icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.name}</span><span className="block text-xs text-muted">{a.description}</span></span>{have.has(a.code) && <Badge tone="good">+{a.xp} XP</Badge>}
          </li>))}</ul>
      </Card>
      <ProfileForm />
    </div>
  );
}
