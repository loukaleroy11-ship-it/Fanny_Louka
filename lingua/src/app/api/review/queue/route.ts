import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { cardFilterSchema } from "@/lib/filters";
import { selectQueue } from "@/lib/review";

const schema = z.object({
  filter: cardFilterSchema,
  limit: z.number().int().min(1).max(500),
  order: z.enum(["smart", "random", "rank"]).default("smart"),
});

export const POST = route(async ({ req, user }) => {
  const { filter, limit, order } = await body(req, schema);
  const { cards, total } = await selectQueue(user, filter, limit, order);
  if (!cards.length) throw new ApiError(404, "No cards match these filters.", { total });
  const session = await db.learningSession.create({ data: { userId: user.id, kind: "REVIEW", meta: { filter, limit, order } } });
  return ok({ sessionId: session.id, total, cards });
});
