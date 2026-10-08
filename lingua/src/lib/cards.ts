import { Prisma, type CardOrigin, type Level, type PartOfSpeech } from "@prisma/client";
import { db } from "./db";
import { CATALOG, SYSTEM_DECK_NAMES } from "./catalog";
import { newCardState } from "./fsrs";
import { lemmaCandidates, normalizeWord } from "./normalize";
import { POS_LABEL } from "./filters";

export const vocabInclude = { frequency: true, lemma: { select: { id: true, word: true } } } satisfies Prisma.VocabularyInclude;

export type VocabWithFreq = Prisma.VocabularyGetPayload<{ include: typeof vocabInclude }>;

/** Ensures the two system decks exist and returns them. */
export async function ensureSystemDecks(userId: string) {
  const words = await db.deck.upsert({
    where: { userId_name: { userId, name: SYSTEM_DECK_NAMES.words } },
    update: {},
    create: { userId, name: SYSTEM_DECK_NAMES.words, description: "Les mots que vous ajoutez vous-même.", kind: "CUSTOM" },
  });
  const mistakes = await db.deck.upsert({
    where: { userId_name: { userId, name: SYSTEM_DECK_NAMES.mistakes } },
    update: {},
    create: { userId, name: SYSTEM_DECK_NAMES.mistakes, description: "Cartes créées à partir de vos erreurs.", kind: "MISTAKES" },
  });
  return { words, mistakes };
}

/** Installs a catalog deck for a user: creates the deck, and one NEW flashcard per word they don't already have. */
export async function installCatalogDeck(userId: string, key: string) {
  const def = CATALOG.find((c) => c.key === key);
  if (!def) throw new Error(`Unknown catalog deck ${key}`);
  const deck = await db.deck.upsert({
    where: { userId_name: { userId, name: def.name } },
    update: {},
    create: { userId, name: def.name, description: def.description, kind: key === "common500" ? "COMMON500" : "CATALOG", catalogKey: key },
  });
  const vocab = await db.vocabulary.findMany({
    where: { ownerId: null, tags: { has: `deck:${key}` } },
    select: { id: true, frequency: { select: { rank: true } } },
  });
  vocab.sort((a, b) => (a.frequency?.rank ?? 1e9) - (b.frequency?.rank ?? 1e9));
  const existing = await db.flashcard.findMany({
    where: { userId, vocabularyId: { in: vocab.map((v) => v.id) } },
    select: { id: true, vocabularyId: true },
  });
  const have = new Map(existing.map((e) => [e.vocabularyId, e.id]));
  const origin: CardOrigin = key === "common500" ? "COMMON500" : "CATALOG";
  const st = newCardState();
  const now = Date.now();
  const missing = vocab.filter((v) => !have.has(v.id));
  await db.flashcard.createMany({
    data: missing.map((v, i) => ({
      userId, vocabularyId: v.id, origin, ...st,
      due: new Date(now), createdAt: new Date(now + i), // monotonic createdAt keeps catalog order for "oldest first"
    })),
    skipDuplicates: true,
  });
  const cards = await db.flashcard.findMany({ where: { userId, vocabularyId: { in: vocab.map((v) => v.id) } }, select: { id: true } });
  await db.deckCard.createMany({ data: cards.map((c) => ({ deckId: deck.id, flashcardId: c.id })), skipDuplicates: true });
  return { deck, added: missing.length, total: cards.length };
}

export async function bootstrapUser(userId: string) {
  await ensureSystemDecks(userId);
  await installCatalogDeck(userId, "common500");
}

/**
 * Idempotent repair: makes sure the system decks exist and the 500-word deck is complete
 * (e.g. the account was created before the lexicon was seeded). Cheap when nothing is missing.
 */
export async function ensureBootstrapped(userId: string) {
  await ensureSystemDecks(userId);
  const [expected, have] = await Promise.all([
    db.vocabulary.count({ where: { ownerId: null, tags: { has: "deck:common500" } } }),
    db.deckCard.count({ where: { deck: { userId, kind: "COMMON500" } } }),
  ]);
  if (expected > 0 && have < expected) await installCatalogDeck(userId, "common500");
}

export interface DuplicateInfo {
  normalized: string;
  /** Entries whose normalised word is exactly the same. */
  exact: {
    vocabulary: VocabWithFreq;
    card: { id: string; decks: string[]; state: number; reps: number } | null;
  }[];
  /** Entries that look like inflected/derived forms (running → run). Informational only — never blocking. */
  related: { vocabulary: VocabWithFreq; relation: "lemma" | "form" | "same-lemma" }[];
}

/**
 * Duplicate detection: exact match is case/space/punctuation-insensitive and spans the global lexicon plus
 * the user's private entries. Different inflections (run / running) are reported as *related*, not duplicates.
 */
export async function findDuplicates(userId: string, word: string, pos?: PartOfSpeech): Promise<DuplicateInfo> {
  const normalized = normalizeWord(word);
  if (!normalized) return { normalized, exact: [], related: [] };
  const where: Prisma.VocabularyWhereInput = {
    normalized,
    OR: [{ ownerId: null }, { ownerId: userId }],
    ...(pos ? { pos } : {}),
  };
  const exactVocab = await db.vocabulary.findMany({ where, include: vocabInclude, orderBy: { frequency: { rank: "asc" } } });
  const cards = exactVocab.length
    ? await db.flashcard.findMany({
        where: { userId, vocabularyId: { in: exactVocab.map((v) => v.id) } },
        select: { id: true, vocabularyId: true, state: true, reps: true, decks: { select: { deck: { select: { name: true } } } } },
      })
    : [];
  const exact = exactVocab.map((vocabulary) => {
    const c = cards.find((x) => x.vocabularyId === vocabulary.id);
    return { vocabulary, card: c ? { id: c.id, decks: c.decks.map((d) => d.deck.name), state: c.state, reps: c.reps } : null };
  });

  const related: DuplicateInfo["related"] = [];
  const seen = new Set(exactVocab.map((v) => v.id));
  const push = async (w: Prisma.VocabularyWhereInput, relation: "lemma" | "form" | "same-lemma") => {
    const found = await db.vocabulary.findMany({ where: { AND: [w, { OR: [{ ownerId: null }, { ownerId: userId }] }] }, include: vocabInclude, take: 8 });
    for (const v of found) if (!seen.has(v.id)) { seen.add(v.id); related.push({ vocabulary: v, relation }); }
  };
  // 1. declared lemma of the exact entry (went → go)
  const lemmaIds = exactVocab.map((v) => v.lemmaId).filter(Boolean) as string[];
  if (lemmaIds.length) await push({ id: { in: lemmaIds } }, "lemma");
  // 2. entries declaring the typed word as lemma (run → running) or sharing the lemma
  if (exactVocab.length) {
    await push({ lemmaId: { in: exactVocab.map((v) => v.id) } }, "form");
    if (lemmaIds.length) await push({ lemmaId: { in: lemmaIds } }, "same-lemma");
  }
  // 3. morphological guess for words not in the lexicon (houses → house)
  if (!exactVocab.length) {
    const cands = lemmaCandidates(normalized);
    if (cands.length) await push({ normalized: { in: cands } }, "lemma");
  }
  return { normalized, exact, related };
}

export interface NewCardInput {
  word: string;
  translation: string;
  example?: string | null;
  exampleTranslation?: string | null;
  definition?: string | null;
  pos: PartOfSpeech;
  level: Level;
  ipa?: string | null;
  tags?: string[];
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  pastSimple?: string | null;
  pastParticiple?: string | null;
  deckId?: string;
  origin?: CardOrigin;
}

/** Creates a private vocabulary entry + flashcard in a deck. Caller is responsible for duplicate confirmation. */
export async function createUserCard(userId: string, input: NewCardInput) {
  const { words } = await ensureSystemDecks(userId);
  let deckId = input.deckId ?? words.id;
  if (input.deckId) {
    const d = await db.deck.findFirst({ where: { id: input.deckId, userId }, select: { id: true } });
    if (!d) deckId = words.id;
  }
  const normalized = normalizeWord(input.word);
  const st = newCardState();
  return db.$transaction(async (tx) => {
    // The same learner may "create anyway": reuse their private entry if (normalized,pos) already exists.
    let vocab = await tx.vocabulary.findFirst({ where: { normalized, pos: input.pos, ownerId: userId } });
    if (!vocab) {
      vocab = await tx.vocabulary.create({
        data: {
          word: input.word.trim(), normalized, ownerId: userId, pos: input.pos, category: POS_LABEL[input.pos],
          level: input.level, translation: input.translation.trim(), ipa: input.ipa || null,
          example: input.example || null, exampleTranslation: input.exampleTranslation || null,
          definition: input.definition || null, tags: input.tags ?? [], synonyms: input.synonyms ?? [],
          antonyms: input.antonyms ?? [], collocations: input.collocations ?? [],
          pastSimple: input.pastSimple || null, pastParticiple: input.pastParticiple || null,
        },
      });
    }
    let card = await tx.flashcard.findUnique({ where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } } });
    if (!card) {
      card = await tx.flashcard.create({
        data: { userId, vocabularyId: vocab.id, origin: input.origin ?? "USER", tags: input.tags ?? [], ...st },
      });
    }
    await tx.deckCard.upsert({
      where: { deckId_flashcardId: { deckId, flashcardId: card.id } },
      update: {},
      create: { deckId, flashcardId: card.id },
    });
    return { card, vocabulary: vocab };
  });
}

/** Adds an existing (global) vocabulary entry to the learner's cards. */
export async function addVocabularyToCards(userId: string, vocabularyId: string, deckId?: string) {
  const vocab = await db.vocabulary.findFirst({ where: { id: vocabularyId, OR: [{ ownerId: null }, { ownerId: userId }] } });
  if (!vocab) return null;
  const { words } = await ensureSystemDecks(userId);
  let target = words.id;
  if (deckId) {
    const d = await db.deck.findFirst({ where: { id: deckId, userId }, select: { id: true } });
    if (d) target = d.id;
  }
  let card = await db.flashcard.findUnique({ where: { userId_vocabularyId: { userId, vocabularyId } } });
  const created = !card;
  if (!card) card = await db.flashcard.create({ data: { userId, vocabularyId, origin: "USER", ...newCardState() } });
  await db.deckCard.upsert({
    where: { deckId_flashcardId: { deckId: target, flashcardId: card.id } },
    update: {},
    create: { deckId: target, flashcardId: card.id },
  });
  return { card, created };
}
