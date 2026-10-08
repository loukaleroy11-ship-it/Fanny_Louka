import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { buildCardWhere, type CardFilter } from "./filters";
import { cardDto } from "./serialize";
import { vocabInclude } from "./cards";
import { previewIntervals } from "./fsrs";
import { dayBounds, localDate } from "./time";

export type QueueOrder = "smart" | "random" | "rank";

/**
 * Selects the cards of a study session.
 * Priority: due cards (oldest due first) → never-seen cards (by frequency rank) → other matching cards
 * (extra practice, e.g. difficult cards that aren't due yet). Filters of the same group are OR-ed,
 * different groups AND-ed (see buildCardWhere).
 */
export async function selectQueue(
  user: { id: string; timezone: string; desiredRetention: number },
  filter: CardFilter,
  limit: number,
  order: QueueOrder,
) {
  const now = new Date();
  const { end } = dayBounds(localDate(now, user.timezone), user.timezone);
  const base = buildCardWhere(user.id, filter, end);
  const notSuspended: Prisma.FlashcardWhereInput = { suspended: false };
  const include = { vocabulary: { include: vocabInclude }, decks: { select: { deck: { select: { id: true, name: true } } } } } satisfies Prisma.FlashcardInclude;
  const rankOrder = { vocabulary: { frequency: { rank: "asc" as const } } };

  const picked: Awaited<ReturnType<typeof db.flashcard.findMany<{ include: typeof include }>>> = [];
  const taken = new Set<string>();
  const take = async (extra: Prisma.FlashcardWhereInput, orderBy: Prisma.FlashcardOrderByWithRelationInput[]) => {
    const remaining = limit - picked.length;
    if (remaining <= 0) return;
    const rows = await db.flashcard.findMany({
      where: { AND: [base, notSuspended, extra, { id: { notIn: [...taken] } }] },
      orderBy,
      take: remaining,
      include,
    });
    for (const r of rows) { taken.add(r.id); picked.push(r); }
  };

  if (order === "rank") {
    await take({}, [rankOrder, { createdAt: "asc" }]);
  } else {
    await take({ state: { not: 0 }, due: { lte: end } }, [{ due: "asc" }]);
    await take({ state: 0 }, [rankOrder, { createdAt: "asc" }]);
    await take({ state: { not: 0 }, due: { gt: end } }, [{ due: "asc" }]);
  }
  if (order === "random") for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }

  const total = await db.flashcard.count({ where: { AND: [base, notSuspended] } });
  return {
    total,
    cards: picked.map((c) => ({ ...cardDto(c), intervals: previewIntervals(c, now, user.desiredRetention) })),
  };
}
