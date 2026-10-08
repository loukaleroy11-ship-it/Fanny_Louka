import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { gradeCard, previewIntervals, intervalLabel } from "@/lib/fsrs";
import { HARD_DIFFICULTY, HARD_LAPSES } from "@/lib/fsrs";
import { recordActivity } from "@/lib/progress";
import { addEvidence, recordSkillResult } from "@/lib/skills";
import { LEVEL_DIFFICULTY } from "@/content/placement";

const schema = z.object({
  flashcardId: z.string(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  durationMs: z.number().int().min(0).max(10 * 60_000).default(0),
  sessionId: z.string().optional(),
});

export const POST = route(async ({ req, user }) => {
  const { flashcardId, rating, durationMs, sessionId } = await body(req, schema);
  const card = await db.flashcard.findFirst({ where: { id: flashcardId, userId: user.id }, include: { vocabulary: { select: { level: true } } } });
  if (!card) throw new ApiError(404, "Card not found");
  const now = new Date();
  const wasHard = card.reps > 0 && (card.lapses >= HARD_LAPSES || card.difficulty >= HARD_DIFFICULTY);
  const { next } = gradeCard(card, rating, now, user.desiredRetention);

  const [updated] = await db.$transaction([
    db.flashcard.update({
      where: { id: card.id },
      data: {
        state: next.state, due: next.due, stability: next.stability, difficulty: next.difficulty,
        elapsedDays: next.elapsedDays, scheduledDays: next.scheduledDays, learningSteps: next.learningSteps,
        reps: next.reps, lapses: next.lapses, lastReview: now,
      },
    }),
    db.review.create({
      data: {
        userId: user.id, flashcardId: card.id, sessionId: sessionId ?? null, rating, stateBefore: card.state,
        stateAfter: next.state, stabilityAfter: next.stability, difficultyAfter: next.difficulty,
        scheduledDays: next.scheduledDays, elapsedDays: next.elapsedDays, dueAfter: next.due, durationMs,
      },
    }),
  ]);

  const isNew = card.state === 0;
  const good = rating >= 3;
  const xp = 3 + (good ? 2 : 0) + (isNew ? 3 : 0);
  const progress = await recordActivity(user.id, {
    cards: 1, newWords: isNew ? 1 : 0, seconds: Math.min(durationMs / 1000, 90), xp,
    hardCards: wasHard ? 1 : 0, mistakeCards: card.origin === "MISTAKE" ? 1 : 0,
  });

  if (card.origin === "MISTAKE") {
    // Success on a mistake card lowers the priority of the underlying grammar skill; failure raises it.
    const skillSlug = card.tags.find((t) => t !== "mistake");
    await recordSkillResult(user.id, skillSlug, good);
  } else {
    await addEvidence(user.id, "VOCABULARY", LEVEL_DIFFICULTY[card.vocabulary.level], good);
  }

  const soon = updated.due.getTime() - now.getTime() < 20 * 60_000;
  return ok({
    card: { id: updated.id, state: updated.state, due: updated.due, reps: updated.reps, lapses: updated.lapses },
    next: intervalLabel(updated.due, now),
    requeue: soon,
    intervals: previewIntervals(updated, now, user.desiredRetention),
    progress,
  });
});
