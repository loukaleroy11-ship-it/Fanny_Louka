import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { CATALOG } from "@/lib/catalog";
import { deckStats } from "@/lib/deckstats";
import { dayBounds, localDate } from "@/lib/time";

export const GET = route(async ({ user }) => {
  const { end } = dayBounds(localDate(new Date(), user.timezone), user.timezone);
  const [decks, stats] = await Promise.all([
    db.deck.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    deckStats(user.id, end),
  ]);
  const empty = { total: 0, newCards: 0, due: 0, mastered: 0, learned: 0 };
  const installed = new Set(decks.map((d) => d.catalogKey).filter(Boolean));
  return ok({
    decks: decks.map((d) => {
      const s = stats.get(d.id) ?? empty;
      return { id: d.id, name: d.name, description: d.description, kind: d.kind, catalogKey: d.catalogKey, ...s, progress: s.total ? s.learned / s.total : 0 };
    }),
    catalog: CATALOG.filter((c) => !installed.has(c.key)).map(({ key, name, description }) => ({ key, name, description })),
  });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).optional() });

export const POST = route(async ({ req, user }) => {
  const { name, description } = await body(req, createSchema);
  if (await db.deck.count({ where: { userId: user.id } }) >= 50) throw new ApiError(400, "Maximum 50 decks");
  if (await db.deck.findUnique({ where: { userId_name: { userId: user.id, name } } })) throw new ApiError(409, "Un deck porte déjà ce nom.");
  const deck = await db.deck.create({ data: { userId: user.id, name, description: description || null, kind: "CUSTOM" } });
  return ok({ deck }, { status: 201 });
});
