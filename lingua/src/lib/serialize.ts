import type { Flashcard, Vocabulary, VocabularyFrequency } from "@prisma/client";
import { difficultyBucket } from "./filters";
import { isMastered } from "./fsrs";

type VocabX = Vocabulary & { frequency?: VocabularyFrequency | null; lemma?: { id: string; word: string } | null };

export function vocabDto(v: VocabX) {
  return {
    id: v.id,
    word: v.word,
    translation: v.translation,
    pos: v.pos,
    category: v.category,
    level: v.level,
    ipa: v.ipa,
    example: v.example,
    exampleTranslation: v.exampleTranslation,
    definition: v.definition,
    synonyms: v.synonyms,
    antonyms: v.antonyms,
    collocations: v.collocations,
    related: v.related,
    tags: v.tags.filter((t) => !t.startsWith("deck:")),
    pastSimple: v.pastSimple,
    pastParticiple: v.pastParticiple,
    rank: v.frequency?.rank ?? null,
    frequencyCount: v.frequency?.count ?? null,
    lemma: v.lemma ?? null,
    isPrivate: !!v.ownerId,
  };
}

type CardX = Flashcard & { vocabulary: VocabX; decks?: { deck: { id: string; name: string } }[] };

export function cardDto(c: CardX) {
  return {
    id: c.id,
    origin: c.origin,
    tags: c.tags,
    note: c.note,
    state: c.state,
    due: c.due,
    reps: c.reps,
    lapses: c.lapses,
    stability: c.stability,
    difficulty: c.difficulty,
    createdAt: c.createdAt,
    lastReview: c.lastReview,
    suspended: c.suspended,
    bucket: difficultyBucket(c),
    mastered: isMastered(c),
    decks: c.decks?.map((d) => ({ id: d.deck.id, name: d.deck.name })) ?? [],
    vocabulary: vocabDto(c.vocabulary),
  };
}

export type CardDto = ReturnType<typeof cardDto>;
export type VocabDto = ReturnType<typeof vocabDto>;
