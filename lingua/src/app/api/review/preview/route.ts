import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { buildCardWhere, cardFilterSchema } from "@/lib/filters";
import { dayBounds, localDate } from "@/lib/time";

const schema = z.object({ filter: cardFilterSchema });

/** How many cards match the chosen filters — shown live in the review setup screen. */
export const POST = route(async ({ req, user }) => {
  const { filter } = await body(req, schema);
  const { end } = dayBounds(localDate(new Date(), user.timezone), user.timezone);
  const where = buildCardWhere(user.id, filter, end);
  const [matching, due, fresh] = await Promise.all([
    db.flashcard.count({ where: { AND: [where, { suspended: false }] } }),
    db.flashcard.count({ where: { AND: [where, { suspended: false, state: { not: 0 }, due: { lte: end } }] } }),
    db.flashcard.count({ where: { AND: [where, { suspended: false, state: 0 }] } }),
  ]);
  return ok({ matching, due, new: fresh });
});
