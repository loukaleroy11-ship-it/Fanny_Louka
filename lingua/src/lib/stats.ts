import { db } from "./db";
import { addDays, dateOnly, localDate } from "./time";
import { getEstimates } from "./skills";
import { levelLabel } from "./levels";
import { mistakeSummary } from "./mistakes";
import { HARD_DIFFICULTY, HARD_LAPSES } from "./fsrs";
import { liveStreak } from "./progress";

export async function getStats(userId: string, days = 30) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const today = localDate(new Date(), user.timezone);
  const from = addDays(today, -(days - 1));

  const [learned, mastered, hard, totalCards, reviewAgg, goals, convs, mistakes, est, mistakeDaily, accDaily, topMistakes, last30] = await Promise.all([
    db.flashcard.count({ where: { userId, reps: { gt: 0 } } }),
    db.flashcard.count({ where: { userId, state: 2, stability: { gte: 21 } } }),
    db.flashcard.count({ where: { userId, reps: { gt: 0 }, OR: [{ lapses: { gte: HARD_LAPSES } }, { difficulty: { gte: HARD_DIFFICULTY } }] } }),
    db.flashcard.count({ where: { userId } }),
    db.review.aggregate({ where: { userId }, _count: { _all: true } }),
    db.dailyGoal.findMany({ where: { userId, date: { gte: dateOnly(from) } }, orderBy: { date: "asc" } }),
    db.conversation.aggregate({ where: { userId, endedAt: { not: null } }, _count: { _all: true }, _sum: { durationSec: true, wordsSpoken: true } }),
    db.mistake.count({ where: { userId } }),
    getEstimates(userId),
    db.$queryRaw<{ d: string; n: bigint }[]>`SELECT to_char(("createdAt" AT TIME ZONE ${user.timezone})::date, 'YYYY-MM-DD') d, COUNT(*) n FROM "Mistake" WHERE "userId" = ${userId} AND "createdAt" >= ${dateOnly(from)} GROUP BY 1`,
    db.$queryRaw<{ d: string; n: bigint; ok: bigint }[]>`SELECT to_char(("reviewedAt" AT TIME ZONE ${user.timezone})::date, 'YYYY-MM-DD') d, COUNT(*) n, COUNT(*) FILTER (WHERE rating >= 3) ok FROM "Review" WHERE "userId" = ${userId} AND "reviewedAt" >= ${dateOnly(from)} GROUP BY 1`,
    mistakeSummary(userId, 8),
    db.review.aggregate({ where: { userId, reviewedAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _count: { _all: true } }),
  ]);
  const totalSeconds = await db.dailyGoal.aggregate({ where: { userId }, _sum: { seconds: true } });
  const okLast30 = await db.review.count({ where: { userId, rating: { gte: 3 }, reviewedAt: { gte: new Date(Date.now() - 30 * 86400000) } } });

  const gMap = new Map(goals.map((g) => [g.date.toISOString().slice(0, 10), g]));
  const mMap = new Map(mistakeDaily.map((r) => [r.d, Number(r.n)]));
  const aMap = new Map(accDaily.map((r) => [r.d, Number(r.ok) / Math.max(1, Number(r.n))]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    const g = gMap.get(d);
    return {
      date: d,
      minutes: Math.round(((g?.seconds ?? 0) + (g?.convSeconds ?? 0)) / 60 * 10) / 10,
      cards: g?.cardsReviewed ?? 0,
      newWords: g?.newWords ?? 0,
      conversations: g?.conversations ?? 0,
      exercises: g?.exercises ?? 0,
      xp: g?.xpEarned ?? 0,
      mistakes: mMap.get(d) ?? 0,
      accuracy: aMap.get(d) ?? null,
    };
  });
  // cumulative words learned ending at today's total
  let run = learned - series.reduce((n, s) => n + s.newWords, 0);
  const cumulative = series.map((s) => ({ date: s.date, value: (run = Math.max(0, run) + s.newWords) }));

  return {
    totals: {
      learned, mastered, hard, totalCards,
      reviews: reviewAgg._count._all,
      successRate: last30._count._all ? okLast30 / last30._count._all : null,
      minutes: Math.round((totalSeconds._sum.seconds ?? 0) / 60) + Math.round((convs._sum.durationSec ?? 0) / 60),
      conversations: convs._count._all,
      wordsSpoken: convs._sum.wordsSpoken ?? 0,
      mistakes,
      streak: liveStreak(user),
      longestStreak: user.longestStreak,
    },
    level: { current: user.level, label: levelLabel(est.overall), overall: est.overall, skills: est.list },
    series,
    cumulative,
    topMistakes,
  };
}
