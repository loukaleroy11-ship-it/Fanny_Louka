import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { refreshLevel } from "@/lib/skills";
import { recordActivity } from "@/lib/progress";

const schema = z.object({ sessionId: z.string() });

export const POST = route(async ({ req, user }) => {
  const { sessionId } = await body(req, schema);
  const s = await db.learningSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!s) throw new ApiError(404, "Session not found");
  const reviews = await db.review.findMany({ where: { sessionId, userId: user.id }, select: { rating: true, durationMs: true } });
  const correct = reviews.filter((r) => r.rating >= 3).length;
  const durationSec = Math.round(reviews.reduce((n, r) => n + Math.min(r.durationMs, 90_000), 0) / 1000);
  const bonus = reviews.length >= 10 ? 10 : 0; // small completion bonus
  await db.learningSession.update({ where: { id: s.id }, data: { endedAt: new Date(), items: reviews.length, correct, durationSec, xp: bonus } });
  const progress = bonus ? await recordActivity(user.id, { xp: bonus }) : null;
  const level = await refreshLevel(user.id);
  return ok({
    items: reviews.length, correct, accuracy: reviews.length ? correct / reviews.length : 0, durationSec,
    again: reviews.filter((r) => r.rating === 1).length,
    levelChanged: level.changed ? { from: level.previous, to: level.level } : null,
    progress,
  });
});
