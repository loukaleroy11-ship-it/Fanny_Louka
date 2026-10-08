import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeWord } from "@/lib/normalize";
import { POS_LABEL } from "@/lib/filters";
import { cardDto } from "@/lib/serialize";
import { vocabInclude } from "@/lib/cards";
import { cardPatchSchema } from "@/lib/validation";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, cardPatchSchema);
  const card = await db.flashcard.findFirst({ where: { id: params.id, userId: user.id }, include: { vocabulary: true } });
  if (!card) throw new ApiError(404, "Card not found");
  const v = card.vocabulary;
  const ownsVocab = v.ownerId === user.id;

  // Content of the shared lexicon is read-only; learners can only edit their own entries.
  const content = ["word", "translation", "example", "exampleTranslation", "definition", "pos", "level", "ipa", "synonyms", "antonyms", "collocations", "pastSimple", "pastParticiple"] as const;
  if (!ownsVocab && content.some((k) => input[k] !== undefined)) {
    throw new ApiError(403, "Cards from the shared lexicon cannot be edited. You can add notes, tags and move them between decks.");
  }
  if (ownsVocab) {
    const pos = input.pos ?? v.pos;
    const word = input.word ?? v.word;
    await db.vocabulary.update({
      where: { id: v.id },
      data: {
        word, normalized: normalizeWord(word), pos, category: POS_LABEL[pos],
        ...(input.translation !== undefined && { translation: input.translation }),
        ...(input.example !== undefined && { example: input.example || null }),
        ...(input.exampleTranslation !== undefined && { exampleTranslation: input.exampleTranslation || null }),
        ...(input.definition !== undefined && { definition: input.definition || null }),
        ...(input.level !== undefined && { level: input.level }),
        ...(input.ipa !== undefined && { ipa: input.ipa || null }),
        ...(input.synonyms !== undefined && { synonyms: input.synonyms }),
        ...(input.antonyms !== undefined && { antonyms: input.antonyms }),
        ...(input.collocations !== undefined && { collocations: input.collocations }),
        ...(input.pastSimple !== undefined && { pastSimple: input.pastSimple || null }),
        ...(input.pastParticiple !== undefined && { pastParticiple: input.pastParticiple || null }),
        ...(input.tags !== undefined && { tags: input.tags }),
      },
    });
  }
  await db.flashcard.update({
    where: { id: card.id },
    data: {
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.note !== undefined && { note: input.note || null }),
      ...(input.suspended !== undefined && { suspended: input.suspended }),
    },
  });
  if (input.deckIds) {
    const decks = await db.deck.findMany({ where: { userId: user.id, id: { in: input.deckIds } }, select: { id: true } });
    await db.$transaction([
      db.deckCard.deleteMany({ where: { flashcardId: card.id, deck: { userId: user.id } } }),
      db.deckCard.createMany({ data: decks.map((d) => ({ deckId: d.id, flashcardId: card.id })) }),
    ]);
  }
  const full = await db.flashcard.findUniqueOrThrow({
    where: { id: card.id },
    include: { vocabulary: { include: vocabInclude }, decks: { select: { deck: { select: { id: true, name: true } } } } },
  });
  return ok({ card: cardDto(full) });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  const card = await db.flashcard.findFirst({ where: { id: params.id, userId: user.id }, include: { vocabulary: { select: { id: true, ownerId: true } } } });
  if (!card) throw new ApiError(404, "Card not found");
  await db.flashcard.delete({ where: { id: card.id } });
  // Private entries die with their only card; shared lexicon entries stay.
  if (card.vocabulary.ownerId === user.id) await db.vocabulary.delete({ where: { id: card.vocabulary.id } }).catch(() => undefined);
  return ok({ ok: true });
});
