import { db } from "./db";
import { dayBounds, localDate } from "./time";
import { getTodayGoal } from "./progress";
import { getEstimates, weakSkills } from "./skills";
import { levelLabel, SKILL_LABEL } from "./levels";
import { SCENARIOS } from "../content/scenarios";
import { HARD_DIFFICULTY, HARD_LAPSES } from "./fsrs";

export interface PlanItem {
  id: string;
  kind: "review" | "new" | "hard" | "mistakes" | "conversation" | "grammar";
  icon: string;
  title: string;
  detail: string;
  target: number;
  done: number;
  minutes: number;
  href: string;
}

export interface DailyPlan {
  items: PlanItem[];
  focus: { slug: string | null; name: string; reason: string } | null;
  plannedMinutes: number;
  targetMinutes: number;
}

const MIN_PER = { review: 0.4, new: 1, hard: 0.6, mistakes: 0.6, grammar: 0.8 };

/**
 * Builds today's plan from level, recurring mistakes, time budget, backlog and recent accuracy.
 * Deterministic and cheap (no LLM): it is recomputed on every dashboard load so it always reflects
 * the latest performance — e.g. new words are cut when the review backlog is large or accuracy drops.
 */
export async function generatePlan(userId: string, now = new Date()): Promise<DailyPlan> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const tz = user.timezone;
  const { end } = dayBounds(localDate(now, tz), tz);
  const goal = await getTodayGoal(userId, tz, now);

  const hardWhere = { reps: { gt: 0 }, OR: [{ lapses: { gte: HARD_LAPSES } }, { difficulty: { gte: HARD_DIFFICULTY } }] };
  const [dueTotal, dueMistakes, newMistakes, hardCount, newAvail, recent, weak, est, recentConvs] = await Promise.all([
    db.flashcard.count({ where: { userId, state: { not: 0 }, due: { lte: end }, suspended: false } }),
    db.flashcard.count({ where: { userId, origin: "MISTAKE", state: { not: 0 }, due: { lte: end } } }),
    db.flashcard.count({ where: { userId, origin: "MISTAKE", state: 0 } }),
    db.flashcard.count({ where: { userId, ...hardWhere } }),
    db.flashcard.count({ where: { userId, state: 0, origin: { not: "MISTAKE" } } }),
    db.review.findMany({ where: { userId }, orderBy: { reviewedAt: "desc" }, take: 50, select: { rating: true } }),
    weakSkills(userId, 3),
    getEstimates(userId),
    db.conversation.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 3, select: { scenario: true } }),
  ]);

  const accuracy = recent.length >= 10 ? recent.filter((r) => r.rating >= 3).length / recent.length : null;
  const budget = Math.max(5, user.dailyMinutes);
  const convMin = budget < 10 ? 3 : Math.min(20, Math.max(5, Math.round(budget * 0.4)));
  const reviewMin = budget * 0.35;

  const reviewDue = Math.max(0, dueTotal - dueMistakes);
  const grammarTarget = budget >= 10 ? 5 : 0;
  const hardTarget = Math.min(5, hardCount);
  const mistakeTarget = Math.min(8, dueMistakes + newMistakes);
  const reviewTarget = Math.min(reviewDue, user.dailyReviewCards, Math.floor(reviewMin / MIN_PER.review));
  // New words fill whatever time is left once the essentials are planned (at least 2 when the budget allows).
  const planned = convMin + reviewTarget * MIN_PER.review + hardTarget * MIN_PER.hard + mistakeTarget * MIN_PER.mistakes + grammarTarget * MIN_PER.grammar;
  const leftover = Math.max(0, budget - planned);
  let newTarget = Math.min(newAvail, user.dailyNewCards, Math.max(budget >= 10 ? 2 : 1, Math.floor(leftover / MIN_PER.new)));
  // adaptivity: heavy backlog or poor accuracy → fewer new words; excellent accuracy → a couple more
  if (reviewDue > user.dailyReviewCards * 2 || (accuracy !== null && accuracy < 0.7)) newTarget = Math.floor(newTarget / 2);
  else if (accuracy !== null && accuracy > 0.92 && newAvail > newTarget) newTarget = Math.min(newAvail, user.dailyNewCards, newTarget + 2);

  // focus = most recurrent weakness, otherwise the weakest language skill
  let focus: DailyPlan["focus"] = null;
  if (weak[0]) {
    focus = { slug: weak[0].skill.lessonSlug ?? null, name: weak[0].skill.name, reason: `${weak[0].mistakes} erreurs récurrentes` };
  } else {
    const lowest = [...est.list].sort((a, b) => a.value - b.value)[0];
    focus = { slug: null, name: SKILL_LABEL[lowest.area], reason: `niveau estimé ${levelLabel(lowest.value)}` };
  }
  const grammarSlug = weak.find((w) => w.skill.lessonSlug)?.skill.lessonSlug ?? "present-simple";
  const grammarName = weak.find((w) => w.skill.lessonSlug)?.skill.name ?? "Present simple";

  const recentIds = new Set(recentConvs.map((c) => c.scenario));
  const scenario = SCENARIOS.find((s) => !recentIds.has(s.id)) ?? SCENARIOS[0];
  const items: PlanItem[] = [];

  if (convMin > 0)
    items.push({
      id: "conversation", kind: "conversation", icon: "🔥", title: `${convMin} min de conversation`,
      detail: `${scenario.emoji} ${scenario.label}`, target: convMin, done: Math.floor(goal.convSeconds / 60), minutes: convMin,
      href: `/conversation?scenario=${scenario.id}`,
    });
  if (reviewTarget > 0)
    items.push({
      id: "review", kind: "review", icon: "📚", title: `${reviewTarget} flashcards à réviser`, detail: `${reviewDue} cartes dues aujourd'hui`,
      target: reviewTarget, done: Math.max(0, goal.cardsReviewed - goal.hardCards - goal.mistakeCards), minutes: Math.round(reviewTarget * MIN_PER.review),
      href: `/review?preset=due&n=${reviewTarget}&go=1`,
    });
  if (hardTarget > 0)
    items.push({
      id: "hard", kind: "hard", icon: "🧠", title: `${hardTarget} mots difficiles`, detail: "Cartes avec lesquelles vous butez",
      target: hardTarget, done: goal.hardCards, minutes: Math.round(hardTarget * MIN_PER.hard), href: `/review?preset=hard&n=${hardTarget}&go=1`,
    });
  if (grammarTarget)
    items.push({
      id: "grammar", kind: "grammar", icon: "✏️", title: `${grammarTarget} exercices de grammaire`, detail: `🎯 ${grammarName}${weak[0] ? " (priorité)" : ""}`,
      target: grammarTarget, done: goal.exercises, minutes: Math.round(grammarTarget * MIN_PER.grammar), href: `/grammar/${grammarSlug}`,
    });
  if (mistakeTarget > 0)
    items.push({
      id: "mistakes", kind: "mistakes", icon: "🩹", title: `Revoir ${mistakeTarget} erreurs`, detail: "Vos propres fautes, transformées en cartes",
      target: mistakeTarget, done: goal.mistakeCards, minutes: Math.round(mistakeTarget * MIN_PER.mistakes), href: `/review?preset=mistakes&n=${mistakeTarget}&go=1`,
    });
  if (newTarget > 0)
    items.push({
      id: "new", kind: "new", icon: "🌱", title: `Apprendre ${newTarget} nouveaux mots`, detail: "Du deck des 500 mots, par fréquence",
      target: newTarget, done: goal.newWords, minutes: Math.round(newTarget * MIN_PER.new), href: `/review?preset=new&n=${newTarget}&go=1`,
    });

  return { items, focus, plannedMinutes: items.reduce((n, i) => n + i.minutes, 0), targetMinutes: user.dailyMinutes };
}
