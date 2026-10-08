import { z } from "zod";
import { route, query, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { buildCardOrder, buildCardWhere, cardFilterSchema, SORTS } from "@/lib/filters";
import { createUserCard, findDuplicates, vocabInclude } from "@/lib/cards";
import { cardDto, vocabDto } from "@/lib/serialize";
import { cardInputSchema } from "@/lib/validation";
import { dayBounds, localDate } from "@/lib/time";

const listSchema = z.object({
  filter: z.string().optional(), // JSON-encoded CardFilter
  sort: z.enum(SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = route(async ({ req, user }) => {
  const q = query(req, listSchema);
  let filter;
  try {
    filter = cardFilterSchema.parse(q.filter ? JSON.parse(q.filter) : {});
  } catch {
    throw new ApiError(400, "Invalid filter");
  }
  const { end } = dayBounds(localDate(new Date(), user.timezone), user.timezone);
  const where = buildCardWhere(user.id, filter, end);
  const [total, cards] = await Promise.all([
    db.flashcard.count({ where }),
    db.flashcard.findMany({
      where,
      orderBy: buildCardOrder(q.sort),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { vocabulary: { include: vocabInclude }, decks: { select: { deck: { select: { id: true, name: true } } } } },
    }),
  ]);
  return ok({ total, page: q.page, pageSize: q.pageSize, cards: cards.map(cardDto) });
});

export const POST = route(async ({ req, user }) => {
  const input = await body(req, cardInputSchema);
  if (!input.force) {
    const dup = await findDuplicates(user.id, input.word, input.pos);
    // A different part of speech is a different entry (work/noun vs work/verb); only same-POS matches block.
    const blocking = dup.exact.filter((e) => e.vocabulary.pos === input.pos);
    if (blocking.length) {
      throw new ApiError(409, "This word already exists.", {
        duplicate: true,
        exact: blocking.map((e) => ({ vocabulary: vocabDto(e.vocabulary), card: e.card })),
      });
    }
  }
  const { card, vocabulary } = await createUserCard(user.id, { ...input, origin: "USER" });
  const full = await db.flashcard.findUniqueOrThrow({
    where: { id: card.id },
    include: { vocabulary: { include: vocabInclude }, decks: { select: { deck: { select: { id: true, name: true } } } } },
  });
  void vocabulary;
  return ok({ card: cardDto(full) }, { status: 201 });
});
