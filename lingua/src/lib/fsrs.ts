import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { Flashcard } from "@prisma/client";

export { Rating, State };

export const RATING_LABEL: Record<number, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

const schedulers = new Map<number, ReturnType<typeof fsrs>>();

/** FSRS-5 scheduler (ts-fsrs). Fuzz is enabled so reviews of cards created together don't bunch up. */
export function scheduler(retention = 0.9) {
  const key = Math.round(retention * 100);
  let s = schedulers.get(key);
  if (!s) {
    s = fsrs(generatorParameters({ request_retention: key / 100, enable_fuzz: true, maximum_interval: 36500 }));
    schedulers.set(key, s);
  }
  return s;
}

type CardState = Pick<
  Flashcard,
  "state" | "due" | "stability" | "difficulty" | "elapsedDays" | "scheduledDays" | "learningSteps" | "reps" | "lapses" | "lastReview"
>;

export function toFsrsCard(c: CardState): Card {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as State,
    last_review: c.lastReview ?? undefined,
  };
}

export function fromFsrsCard(c: Card): CardState {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as number,
    lastReview: c.last_review ?? null,
  };
}

/** Initial persisted state for a brand-new card. */
export function newCardState(now = new Date()): CardState {
  return fromFsrsCard(createEmptyCard(now));
}

export function gradeCard(card: CardState, rating: 1 | 2 | 3 | 4, now = new Date(), retention = 0.9) {
  const res = scheduler(retention).next(toFsrsCard(card), now, rating as Grade);
  return { next: fromFsrsCard(res.card), log: res.log };
}

/** Human interval label ("10 min", "3 days", "2 months") from now to a due date. */
export function intervalLabel(due: Date, now = new Date()): string {
  const ms = due.getTime() - now.getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mo`;
  return `${(d / 365).toFixed(1)} y`;
}

/** Preview of the four possible next intervals, shown on the rating buttons. */
export function previewIntervals(card: CardState, now = new Date(), retention = 0.9) {
  const rec = scheduler(retention).repeat(toFsrsCard(card), now);
  const out: Record<number, string> = {};
  for (const r of [1, 2, 3, 4] as const) out[r] = intervalLabel(rec[r as Grade].card.due, now);
  return out;
}

/** "Difficult" = it lapsed at least twice, or FSRS difficulty is high on a card already studied. */
export const HARD_LAPSES = 2;
export const HARD_DIFFICULTY = 7;

export function isMastered(c: Pick<Flashcard, "state" | "stability">) {
  return c.state === State.Review && c.stability >= 21;
}
