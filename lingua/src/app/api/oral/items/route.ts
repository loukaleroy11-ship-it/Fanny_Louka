import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { GRAMMAR_LESSONS } from "@/content/grammar";
import { levelIndex } from "@/lib/levels";

const schema = z.object({ n: z.coerce.number().int().min(1).max(20).default(8) });
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Sentences for listening / repeating practice: examples of the learner's cards and of the grammar lessons, around their level. */
export const GET = route(async ({ req, user }) => {
  const { n } = query(req, schema);
  const maxLevel = Math.min(5, levelIndex(user.level) + 1);
  const levels = (["A1", "A2", "B1", "B2", "C1", "C2"] as const).slice(0, maxLevel + 1);
  const cards = await db.flashcard.findMany({
    where: { userId: user.id, origin: { not: "MISTAKE" }, vocabulary: { example: { not: null }, exampleTranslation: { not: null }, level: { in: [...levels] } } },
    select: { reps: true, vocabulary: { select: { id: true, example: true, exampleTranslation: true, level: true, word: true } } },
    take: 300,
    orderBy: { reps: "desc" },
  });
  const fromCards = shuffle(cards.filter((c) => !!c.vocabulary.exampleTranslation?.trim() && (c.vocabulary.example ?? "").split(" ").length >= 3 && (c.vocabulary.example ?? "").length <= 110))
    .slice(0, Math.ceil(n / 2))
    .map((c) => ({ id: `v:${c.vocabulary.id}`, sentence: c.vocabulary.example!, translation: c.vocabulary.exampleTranslation ?? "", level: c.vocabulary.level, hint: c.vocabulary.word }));
  const fromLessons = shuffle(GRAMMAR_LESSONS.filter((l) => levelIndex(l.level) <= maxLevel).flatMap((l) => l.examples.map((e, i) => ({ id: `g:${l.slug}:${i}`, sentence: e.en, translation: e.fr, level: l.level, hint: l.title }))));
  const items = shuffle([...fromCards, ...fromLessons.slice(0, n - fromCards.length)]).slice(0, n);
  return ok({ items });
});
