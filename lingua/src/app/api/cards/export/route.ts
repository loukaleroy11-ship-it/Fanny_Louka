import { z } from "zod";
import { route, query, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { FORMATS, type CardRecord } from "@/lib/exchange";
import { POS_LABEL } from "@/lib/filters";

const schema = z.object({ format: z.enum(["csv", "anki-tsv"]).default("csv"), deckId: z.string().optional(), scope: z.enum(["all", "mine"]).default("all") });

export const GET = route(async ({ req, user }) => {
  const { format, deckId, scope } = query(req, schema);
  if (deckId && !(await db.deck.findFirst({ where: { id: deckId, userId: user.id }, select: { id: true } }))) throw new ApiError(404, "Deck not found");
  const cards = await db.flashcard.findMany({
    where: { userId: user.id, ...(deckId && { decks: { some: { deckId } } }), ...(scope === "mine" && { origin: { in: ["USER", "AI", "IMPORT"] } }) },
    include: { vocabulary: { include: { frequency: true } } },
    orderBy: [{ vocabulary: { frequency: { rank: "asc" } } }, { createdAt: "asc" }],
  });
  const records: CardRecord[] = cards.map((c) => ({
    english: c.vocabulary.word, french: c.vocabulary.translation, example: c.vocabulary.example ?? "",
    exampleTranslation: c.vocabulary.exampleTranslation ?? "", category: c.vocabulary.category,
    partOfSpeech: POS_LABEL[c.vocabulary.pos], level: c.vocabulary.level, rank: c.vocabulary.frequency?.rank?.toString() ?? "",
    tags: [...new Set([...c.tags, ...c.vocabulary.tags.filter((t) => !t.startsWith("deck:"))])],
  }));
  const f = FORMATS[format];
  return new Response(f.serialize(records), {
    headers: { "Content-Type": f.mime, "Content-Disposition": `attachment; filename="lingua-cards.${f.ext}"`, "Cache-Control": "no-store" },
  });
});
