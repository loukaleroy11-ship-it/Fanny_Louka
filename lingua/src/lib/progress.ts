import { db } from "./db";
import { addDays, dateOnly, diffDays, localDate } from "./time";
import { ACHIEVEMENTS, achievementByCode } from "./achievements";

export interface Activity {
  seconds?: number;
  cards?: number;
  newWords?: number;
  conversations?: number;
  exercises?: number;
  mistakeCards?: number;
  hardCards?: number;
  convSeconds?: number;
  oral?: number;
  xp?: number;
  perfectLesson?: boolean;
}

export interface ProgressResult {
  xpGained: number;
  streak: number;
  unlocked: { code: string; name: string; icon: string }[];
}

/** Today's DailyGoal row for the user (created lazily from their current targets). */
export async function getTodayGoal(userId: string, tz: string, now = new Date()) {
  const day = localDate(now, tz);
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { dailyMinutes: true, dailyReviewCards: true, dailyNewCards: true, dailyConversations: true },
  });
  return db.dailyGoal.upsert({
    where: { userId_date: { userId, date: dateOnly(day) } },
    update: {},
    create: {
      userId, date: dateOnly(day), targetMinutes: u.dailyMinutes, targetCards: u.dailyReviewCards,
      targetNewWords: u.dailyNewCards, targetConversations: u.dailyConversations,
    },
  });
}

/** Records learning activity: daily counters, XP, streak, achievements. */
export async function recordActivity(userId: string, a: Activity, now = new Date()): Promise<ProgressResult> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, streak: true, longestStreak: true, lastActiveDate: true, xp: true },
  });
  const goal = await getTodayGoal(userId, user.timezone, now);
  const today = localDate(now, user.timezone);
  const xp = Math.round(a.xp ?? 0);

  await db.dailyGoal.update({
    where: { id: goal.id },
    data: {
      seconds: { increment: Math.round(a.seconds ?? 0) },
      cardsReviewed: { increment: a.cards ?? 0 },
      newWords: { increment: a.newWords ?? 0 },
      conversations: { increment: a.conversations ?? 0 },
      exercises: { increment: a.exercises ?? 0 },
      mistakeCards: { increment: a.mistakeCards ?? 0 },
      hardCards: { increment: a.hardCards ?? 0 },
      convSeconds: { increment: Math.round(a.convSeconds ?? 0) },
      oralItems: { increment: a.oral ?? 0 },
      xpEarned: { increment: xp },
    },
  });

  let streak = user.streak;
  const last = user.lastActiveDate ? user.lastActiveDate.toISOString().slice(0, 10) : null;
  if (last !== today) {
    streak = last && diffDays(today, last) === 1 ? user.streak + 1 : 1;
    await db.user.update({
      where: { id: userId },
      data: { streak, longestStreak: Math.max(user.longestStreak, streak), lastActiveDate: dateOnly(today) },
    });
  }
  if (xp) await db.user.update({ where: { id: userId }, data: { xp: { increment: xp } } });

  const unlocked = await checkAchievements(userId, streak, a.perfectLesson);
  const bonus = unlocked.reduce((n, u) => n + (achievementByCode(u.code)?.xp ?? 0), 0);
  if (bonus) await db.user.update({ where: { id: userId }, data: { xp: { increment: bonus } } });
  return { xpGained: xp + bonus, streak, unlocked };
}

/** A streak is only "alive" if the learner studied today or yesterday. */
export function liveStreak(user: { streak: number; lastActiveDate: Date | null; timezone: string }, now = new Date()) {
  if (!user.lastActiveDate) return 0;
  const today = localDate(now, user.timezone);
  const last = user.lastActiveDate.toISOString().slice(0, 10);
  return diffDays(today, last) <= 1 ? user.streak : 0;
}

export async function unlock(userId: string, code: string) {
  const def = achievementByCode(code);
  if (!def) return null;
  try {
    await db.achievement.create({ data: { userId, code } });
    return { code, name: def.name, icon: def.icon };
  } catch {
    return null; // already unlocked (unique constraint)
  }
}

async function checkAchievements(userId: string, streak: number, perfectLesson?: boolean) {
  const have = new Set((await db.achievement.findMany({ where: { userId }, select: { code: true } })).map((a) => a.code));
  const todo = ACHIEVEMENTS.filter((a) => !have.has(a.code)).map((a) => a.code);
  if (!todo.length) return [];
  const [reviews, learned, convs, converted] = await Promise.all([
    db.review.count({ where: { userId } }),
    db.flashcard.count({ where: { userId, reps: { gt: 0 } } }),
    db.conversation.count({ where: { userId, endedAt: { not: null } } }),
    db.mistake.count({ where: { userId, flashcardId: { not: null } } }),
  ]);
  const ok: Record<string, boolean> = {
    "first-review": reviews >= 1,
    "streak-3": streak >= 3,
    "streak-7": streak >= 7,
    "streak-30": streak >= 30,
    "words-100": learned >= 100,
    "words-500": learned >= 500,
    "reviews-100": reviews >= 100,
    "reviews-1000": reviews >= 1000,
    "first-conversation": convs >= 1,
    "conversations-10": convs >= 10,
    "mistake-hunter": converted >= 10,
    "perfect-lesson": !!perfectLesson,
  };
  const out: { code: string; name: string; icon: string }[] = [];
  for (const code of todo) {
    if (ok[code]) {
      const u = await unlock(userId, code);
      if (u) out.push(u);
    }
  }
  return out;
}

export { addDays };
