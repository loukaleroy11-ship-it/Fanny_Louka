import { z } from "zod";
import type { Prisma, PartOfSpeech } from "@prisma/client";
import { HARD_DIFFICULTY, HARD_LAPSES } from "./fsrs";

import { FUNCTION_FILTERS, type FunctionKey } from "./labels";
export { FUNCTION_FILTERS, FUNCTION_LABEL, POS_LABEL, type FunctionKey } from "./labels";

const level = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

export const cardFilterSchema = z.object({
  /** OR-combined origins: my own cards, cards generated from my mistakes, the 500-word deck. */
  scope: z.array(z.enum(["mine", "mistakes", "common500"])).default([]),
  deckId: z.string().optional(),
  /** Restrict to specific cards (e.g. "Study existing card"). */
  ids: z.array(z.string()).max(100).optional(),
  /** OR-combined statuses. */
  status: z.array(z.enum(["due", "new", "learning", "mastered"])).default([]),
  /** OR-combined personal-difficulty buckets (based on FSRS difficulty + lapses). */
  difficulty: z.array(z.enum(["easy", "medium", "hard"])).default([]),
  functions: z.array(z.enum(Object.keys(FUNCTION_FILTERS) as [FunctionKey, ...FunctionKey[]])).default([]),
  levels: z.array(level).default([]),
  rankMin: z.number().int().min(1).optional(),
  rankMax: z.number().int().min(1).optional(),
  q: z.string().max(100).optional(),
  tag: z.string().max(40).optional(),
});

export type CardFilter = z.infer<typeof cardFilterSchema>;

export const SORTS = ["rank", "function", "level", "difficulty", "newest", "oldest", "alpha", "due"] as const;
export type CardSort = (typeof SORTS)[number];

const hardWhere: Prisma.FlashcardWhereInput = {
  reps: { gt: 0 },
  OR: [{ lapses: { gte: HARD_LAPSES } }, { difficulty: { gte: HARD_DIFFICULTY } }],
};

/**
 * Translates a CardFilter into a Prisma where clause.
 * Combination rule: values inside one group are OR-ed, different groups are AND-ed
 * (e.g. verbs + rank 1–200 + difficult cards = difficult verbs ranked 1–200).
 */
export function buildCardWhere(userId: string, f: CardFilter, dueBefore: Date): Prisma.FlashcardWhereInput {
  const and: Prisma.FlashcardWhereInput[] = [{ userId }];

  if (f.deckId) and.push({ decks: { some: { deckId: f.deckId } } });
  if (f.ids?.length) and.push({ id: { in: f.ids } });

  if (f.scope.length) {
    const or: Prisma.FlashcardWhereInput[] = [];
    if (f.scope.includes("mine")) or.push({ origin: { in: ["USER", "AI", "IMPORT"] } });
    if (f.scope.includes("mistakes")) or.push({ origin: "MISTAKE" });
    if (f.scope.includes("common500")) or.push({ decks: { some: { deck: { kind: "COMMON500" } } } });
    and.push({ OR: or });
  }

  if (f.status.length) {
    const or: Prisma.FlashcardWhereInput[] = [];
    if (f.status.includes("due")) or.push({ state: { not: 0 }, due: { lte: dueBefore } });
    if (f.status.includes("new")) or.push({ state: 0 });
    if (f.status.includes("learning")) or.push({ state: { in: [1, 3] } });
    if (f.status.includes("mastered")) or.push({ state: 2, stability: { gte: 21 } });
    and.push({ OR: or });
  }

  if (f.difficulty.length) {
    const or: Prisma.FlashcardWhereInput[] = [];
    if (f.difficulty.includes("hard")) or.push(hardWhere);
    if (f.difficulty.includes("medium"))
      or.push({ reps: { gt: 0 }, lapses: { lt: HARD_LAPSES }, difficulty: { gte: 4, lt: HARD_DIFFICULTY } });
    if (f.difficulty.includes("easy")) or.push({ reps: { gt: 0 }, lapses: { lt: HARD_LAPSES }, difficulty: { lt: 4 } });
    and.push({ OR: or });
  }

  const vocab: Prisma.VocabularyWhereInput = {};
  if (f.functions.length) {
    const pos = [...new Set(f.functions.flatMap((k) => [...FUNCTION_FILTERS[k]]))] as PartOfSpeech[];
    vocab.pos = { in: pos };
  }
  if (f.levels.length) vocab.level = { in: f.levels };
  if (f.rankMin !== undefined || f.rankMax !== undefined) {
    vocab.frequency = { is: { rank: { gte: f.rankMin, lte: f.rankMax } } };
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    vocab.OR = [
      { word: { contains: q, mode: "insensitive" } },
      { translation: { contains: q, mode: "insensitive" } },
      { example: { contains: q, mode: "insensitive" } },
    ];
  }
  if (Object.keys(vocab).length) and.push({ vocabulary: vocab });

  if (f.tag) and.push({ OR: [{ tags: { has: f.tag } }, { vocabulary: { tags: { has: f.tag } } }] });

  return { AND: and };
}

export function buildCardOrder(sort: CardSort): Prisma.FlashcardOrderByWithRelationInput[] {
  switch (sort) {
    case "rank":
      return [{ vocabulary: { frequency: { rank: "asc" } } }, { createdAt: "asc" }];
    case "function":
      return [{ vocabulary: { pos: "asc" } }, { vocabulary: { frequency: { rank: "asc" } } }];
    case "level":
      return [{ vocabulary: { level: "asc" } }, { vocabulary: { frequency: { rank: "asc" } } }];
    case "difficulty":
      return [{ lapses: "desc" }, { difficulty: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }];
    case "alpha":
      return [{ vocabulary: { normalized: "asc" } }];
    case "due":
      return [{ due: "asc" }];
  }
}

export type Difficulty = "new" | "easy" | "medium" | "hard";

export function difficultyBucket(c: { reps: number; lapses: number; difficulty: number }): Difficulty {
  if (c.reps === 0) return "new";
  if (c.lapses >= HARD_LAPSES || c.difficulty >= HARD_DIFFICULTY) return "hard";
  if (c.difficulty >= 4) return "medium";
  return "easy";
}
