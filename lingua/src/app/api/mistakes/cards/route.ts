import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { createMistakeCard } from "@/lib/mistakes";

const schema = z.object({ conversationId: z.string().optional(), ids: z.array(z.string()).max(100).optional() });

/** Bulk "Add mistakes to my flashcards" (whole conversation, selected ids, or every unconverted mistake). */
export const POST = route(async ({ req, user }) => {
  const { conversationId, ids } = await body(req, schema);
  const list = await db.mistake.findMany({
    where: { userId: user.id, flashcardId: null, ...(conversationId && { conversationId }), ...(ids && { id: { in: ids } }) },
    select: { id: true },
    take: 100,
  });
  let created = 0;
  for (const m of list) {
    const r = await createMistakeCard(user.id, m.id);
    if (r?.created) created++;
  }
  return ok({ created, considered: list.length });
});
