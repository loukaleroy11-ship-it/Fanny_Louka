import { mistakesLabel } from "@/lib/format";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Check, Flame, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { generatePlan } from "@/lib/plan";
import { getTodayGoal, liveStreak } from "@/lib/progress";
import { getEstimates } from "@/lib/skills";
import { levelLabel, levelOf, LEVELS, SKILL_LABEL } from "@/lib/levels";
import { mistakeSummary } from "@/lib/mistakes";
import { getStats } from "@/lib/stats";
import { dayBounds, localDate } from "@/lib/time";
import { achievementByCode, playerLevel } from "@/lib/achievements";
import { Badge, Button, Card, Progress } from "@/components/ui";
import { BarChart, HBar, Ring } from "@/components/charts";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const { end } = dayBounds(localDate(now, user.timezone), user.timezone);
  const [plan, goal, est, mistakes, stats, dueCount, achievements] = await Promise.all([
    generatePlan(user.id, now),
    getTodayGoal(user.id, user.timezone, now),
    getEstimates(user.id),
    mistakeSummary(user.id, 4),
    getStats(user.id, 7),
    db.flashcard.count({ where: { userId: user.id, state: { not: 0 }, due: { lte: end }, suspended: false } }),
    db.achievement.findMany({ where: { userId: user.id }, orderBy: { unlockedAt: "desc" }, take: 6 }),
  ]);

  const minutes = Math.round(((goal.seconds + goal.convSeconds) / 60) * 10) / 10;
  const pct = Math.min(1, minutes / Math.max(1, goal.targetMinutes));
  const streak = liveStreak(user, now);
  const idx = LEVELS.indexOf(levelOf(est.overall));
  const nextLevel = LEVELS[Math.min(5, idx + 1)];
  const levelFrac = est.overall - Math.floor(est.overall);
  const p = playerLevel(user.xp);
  const doneItems = plan.items.filter((i) => i.done >= i.target).length;
  const convMinutes = Math.round(goal.convSeconds / 60);
  const top = mistakes[0];

  return (
    <div className="space-y-6">
      <div className="anim-up flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting(user.timezone)}, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted">Niveau {levelLabel(est.overall)} · objectif : {user.goal}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={streak > 0 ? "warn" : "neutral"} className="!px-3 !py-1.5 !text-sm"><Flame className="size-4" /> {streak} day streak</Badge>
          <Badge tone="brand" className="!px-3 !py-1.5 !text-sm">Lv {p.level} · {user.xp} XP</Badge>
        </div>
      </div>

      {!user.placementDone && (
        <Card className="flex flex-wrap items-center justify-between gap-3 !border-brand/40 !bg-brand-soft">
          <div><p className="font-semibold">🎯 Faites le test de niveau</p><p className="text-sm text-muted">6 minutes pour personnaliser votre programme et votre professeur IA.</p></div>
          <Link href="/placement"><Button>Passer le test</Button></Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="anim-up">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Today&apos;s progress</h2><span className="text-sm text-muted tabular-nums">{minutes} / {goal.targetMinutes} min</span></div>
            <Progress value={pct} label="Progression du jour" className="mt-3 !h-3" tone={pct >= 1 ? "good" : "brand"} />
            <p className="mt-2 text-sm text-muted" aria-hidden>{"█".repeat(Math.round(pct * 10))}{"░".repeat(10 - Math.round(pct * 10))} {Math.round(pct * 100)}%</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-muted">Today&apos;s review</dt><dd className="text-xl font-semibold tabular-nums">{dueCount}</dd><dd className="text-xs text-muted">cartes</dd></div>
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-muted">Vocabulary</dt><dd className="text-xl font-semibold tabular-nums">+{goal.newWords}</dd><dd className="text-xs text-muted">mots</dd></div>
              <div className="rounded-xl bg-surface-2 p-3"><dt className="text-xs text-muted">Conversation</dt><dd className="text-xl font-semibold tabular-nums">{convMinutes}</dd><dd className="text-xs text-muted">min</dd></div>
            </dl>
          </Card>

          <Card className="anim-up">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Today&apos;s plan</h2><span className="text-sm text-muted">{doneItems}/{plan.items.length} · ~{plan.plannedMinutes} min</span></div>
            {plan.focus && <p className="mt-1 text-sm text-muted">🎯 Priorité du jour : <b className="text-text">{plan.focus.name}</b> ({plan.focus.reason})</p>}
            {plan.items.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Rien à planifier : ajoutez des cartes ou lancez une conversation.</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {plan.items.map((it, n) => {
                  const done = it.done >= it.target;
                  return (
                    <li key={it.id}>
                      <Link href={it.href} className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-3 py-2 transition hover:border-brand hover:bg-brand-soft/50">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg" aria-hidden>{done ? <Check className="size-5 text-accent" /> : it.icon}</span>
                        <span className="min-w-0 flex-1"><span className={`block text-sm font-medium ${done ? "text-muted line-through" : ""}`}>{n + 1}. {it.title}</span><span className="block truncate text-xs text-muted">{it.detail}</span></span>
                        <span className="text-xs tabular-nums text-muted">{Math.min(it.done, it.target)}/{it.target}</span>
                        <ArrowRight className="size-4 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">7 derniers jours</h2>
            <BarChart data={stats.series.map((s) => ({ label: s.date.slice(5), value: s.minutes }))} unit=" min" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="text-center">
            <p className="text-sm text-muted">Niveau estimé</p>
            <div className="my-3 flex justify-center">
              <Ring value={levelFrac} size={132} stroke={12} label={`Progression vers ${nextLevel}`}>
                <div><div className="text-3xl font-semibold">{levelLabel(est.overall)}</div><div className="text-xs text-muted">→ {nextLevel}</div></div>
              </Ring>
            </div>
            <ul className="space-y-1.5 text-left text-sm">
              {est.list.map((e) => (
                <li key={e.area} className="flex items-center justify-between"><span className="text-muted">{SKILL_LABEL[e.area]}</span><b>{levelLabel(e.value)}</b></li>
              ))}
            </ul>
            <Link href="/progress" className="mt-2 inline-flex min-h-11 items-center text-sm text-brand hover:underline">Voir ma progression</Link>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Weakness</h2><Link href="/mistakes" className="inline-flex min-h-11 items-center text-sm text-brand hover:underline">Tout voir</Link></div>
            {mistakes.length === 0 ? (
              <p className="text-sm text-muted">Aucune erreur enregistrée pour l&apos;instant. Parlez avec le professeur IA pour que Lingua repère vos points faibles.</p>
            ) : (
              <div className="space-y-3">
                {mistakes.map((m) => <HBar key={m.label} label={m.label} value={m.count} max={mistakes[0].count} right={mistakesLabel(m.count)} tone="warn" />)}
                {top && <Link href={top.slug ? `/grammar/${top.slug}` : "/grammar"} className="inline-flex min-h-11 items-center gap-1 text-sm text-brand hover:underline"><Target className="size-4" /> Travailler « {top.label} »</Link>}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">Réviser</h2>
            <p className="text-sm text-muted">{dueCount > 0 ? `${dueCount} cartes à revoir aujourd'hui.` : "Aucune carte due. Apprenez de nouveaux mots !"}</p>
            <Link href="/review" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand font-medium text-brand-ink hover:brightness-110"><BookOpen className="size-4" /> Réviser</Link>
          </Card>

          {achievements.length > 0 && (
            <Card>
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Trophy className="size-4 text-warn" /> Badges</h2>
              <ul className="flex flex-wrap gap-2">{achievements.map((a) => { const d = achievementByCode(a.code); return d ? <li key={a.code}><Badge tone="warn" className="!py-1.5"><span aria-hidden>{d.icon}</span> {d.name}</Badge></li> : null; })}</ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
