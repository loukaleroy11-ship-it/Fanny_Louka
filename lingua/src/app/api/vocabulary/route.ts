import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { FUNCTION_FILTERS, type FunctionKey } from "@/lib/filters";
import { vocabInclude } from "@/lib/cards";
import { vocabDto } from "@/lib/serialize";

const schema = z.object({
  fn: z.enum(Object.keys(FUNCTION_FILTERS) as [FunctionKey, ...FunctionKey[]]).optional(),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  q: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** Browse the shared lexicon by grammatical function. */
export const GET = route(async ({ req, user }) => {
  const { fn, level, q, page } = query(req, schema);
  const where = {
    ownerId: null,
    ...(fn && { pos: { in: [...FUNCTION_FILTERS[fn]] } }),
    ...(level && { level }),
    ...(q && { OR: [{ normalized: { contains: q.toLowerCase() } }, { translation: { contains: q, mode: "insensitive" as const } }] }),
  };
  const [total, rows, counts] = await Promise.all([
    db.vocabulary.count({ where }),
    db.vocabulary.findMany({ where, include: vocabInclude, orderBy: [{ frequency: { rank: "asc" } }, { normalized: "asc" }], skip: (page - 1) * 40, take: 40 }),
    db.vocabulary.groupBy({ by: ["pos"], where: { ownerId: null }, _count: { _all: true } }),
  ]);
  const cards = await db.flashcard.findMany({ where: { userId: user.id, vocabularyId: { in: rows.map((r) => r.id) } }, select: { vocabularyId: true } });
  const have = new Set(cards.map((c) => c.vocabularyId));
  return ok({ total, items: rows.map((r) => ({ ...vocabDto(r), inCards: have.has(r.id) })), counts: Object.fromEntries(counts.map((c) => [c.pos, c._count._all])) });
});
