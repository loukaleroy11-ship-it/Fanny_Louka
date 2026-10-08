import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ top: z.coerce.number().int().min(1).max(200).default(100), irregular: z.enum(["1", "0"]).optional() });

/** Most common verbs: base / past simple / past participle / translation, ranked by corpus frequency. */
export const GET = route(async ({ req, user }) => {
  const { top, irregular } = query(req, schema);
  const verbs = await db.vocabulary.findMany({
    where: { ownerId: null, tags: { has: "deck:verbs" }, ...(irregular === "1" && { tags: { hasEvery: ["deck:verbs", "irregular"] } }) },
    include: { frequency: true },
  });
  // verbRank = rank by summed frequency of all inflected forms (see scripts/build-verbs.py)
  const ranked = verbs.sort((a, b) => (a.verbRank ?? 9999) - (b.verbRank ?? 9999)).slice(0, top);
  const cards = await db.flashcard.findMany({ where: { userId: user.id, vocabularyId: { in: ranked.map((v) => v.id) } }, select: { vocabularyId: true, id: true } });
  return ok(
    {
      verbs: ranked.map((v, i) => ({
        id: v.id, verbRank: v.verbRank ?? i + 1, rank: v.frequency?.rank ?? null, base: v.word, past: v.pastSimple, participle: v.pastParticiple,
        translation: v.translation, ipa: v.ipa, example: v.example, exampleTranslation: v.exampleTranslation, level: v.level,
        irregular: v.tags.includes("irregular"), inCards: cards.some((c) => c.vocabularyId === v.id),
      })),
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
});
