import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeWord } from "@/lib/normalize";
import { vocabInclude } from "@/lib/cards";
import { vocabDto } from "@/lib/serialize";
import { GRAMMAR_LESSONS } from "@/content/grammar";

const schema = z.object({ q: z.string().trim().min(1).max(80) });

/** Global search: lexicon (English + French), related forms, user's card status, grammar lessons, cognates. */
export const GET = route(async ({ req, user }) => {
  const { q } = query(req, schema);
  const n = normalizeWord(q);
  const access = [{ ownerId: null }, { ownerId: user.id }];
  const vocab = await db.vocabulary.findMany({
    where: {
      OR: access,
      AND: [{ OR: [{ normalized: { startsWith: n } }, { normalized: { contains: n } }, { translation: { contains: q, mode: "insensitive" } }, { related: { has: n } }] }],
    },
    include: vocabInclude,
    take: 60,
  });
  // exact first, then prefix, then rank
  vocab.sort((a, b) => {
    const s = (v: typeof a) => (v.normalized === n ? 0 : v.normalized.startsWith(n) ? 1 : v.related.includes(n) ? 2 : 3);
    return s(a) - s(b) || (a.frequency?.rank ?? 1e9) - (b.frequency?.rank ?? 1e9);
  });
  const top = vocab.slice(0, 12);
  const cards = await db.flashcard.findMany({ where: { userId: user.id, vocabularyId: { in: top.map((v) => v.id) } }, select: { id: true, vocabularyId: true } });
  const forms = await db.vocabulary.findMany({ where: { lemmaId: { in: top.map((v) => v.id) } }, select: { lemmaId: true, word: true } });
  const cognates = await db.cognate.findMany({ where: { OR: [{ english: { contains: q, mode: "insensitive" } }, { french: { contains: q, mode: "insensitive" } }] }, take: 6 });
  const lessons = GRAMMAR_LESSONS.filter((l) => `${l.title} ${l.titleFr}`.toLowerCase().includes(q.toLowerCase())).map((l) => ({ slug: l.slug, title: l.title, titleFr: l.titleFr, level: l.level }));
  return ok({
    results: top.map((v) => ({
      ...vocabDto(v),
      inCards: cards.some((c) => c.vocabularyId === v.id),
      cardId: cards.find((c) => c.vocabularyId === v.id)?.id ?? null,
      forms: [...new Set([...v.related, ...forms.filter((f) => f.lemmaId === v.id).map((f) => f.word)])].slice(0, 10),
    })),
    cognates,
    lessons,
  });
});
