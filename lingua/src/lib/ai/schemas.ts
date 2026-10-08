import { z } from "zod";

export const MISTAKE_CATEGORIES = ["GRAMMAR", "VOCABULARY", "PREPOSITION", "SPELLING", "PRONUNCIATION", "WORD_ORDER", "OTHER"] as const;
export const SKILL_SLUGS = [
  "present-simple", "present-continuous", "past-simple", "present-perfect", "future-forms", "articles", "prepositions",
  "plurals", "word-order", "modal-verbs", "comparatives", "conditionals", "vocabulary-choice", "spelling", "pronunciation",
] as const;

const cat = z.enum(MISTAKE_CATEGORIES).catch("GRAMMAR");
const skill = z.enum(SKILL_SLUGS).nullable().catch(null);

export const correctionSchema = z.object({
  original: z.string().min(1).max(500),
  corrected: z.string().min(1).max(500),
  explanation: z.string().max(400).catch(""),
  category: cat,
  skill,
});
export type Correction = z.infer<typeof correctionSchema>;

export const turnSchema = z.object({
  reply: z.string().min(1).max(1200),
  corrections: z.array(correctionSchema).max(3).catch([]),
  newWords: z.array(z.object({ word: z.string().max(40), meaning: z.string().max(120) })).max(5).catch([]),
});
export type TurnResult = z.infer<typeof turnSchema>;

export const POS_VALUES = ["NOUN", "VERB", "ADJECTIVE", "ADVERB", "PRONOUN", "PREPOSITION", "CONJUNCTION", "DETERMINER", "AUXILIARY", "MODAL", "PHRASAL_VERB", "EXPRESSION", "INTERJECTION"] as const;
export const LEVEL_VALUES = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export const flashcardDraftSchema = z.object({
  word: z.string().max(80),
  translation: z.string().max(120),
  definition: z.string().max(300).catch(""),
  example: z.string().max(300).catch(""),
  exampleTranslation: z.string().max(300).catch(""),
  pos: z.enum(POS_VALUES).catch("NOUN"),
  level: z.enum(LEVEL_VALUES).catch("B1"),
  ipa: z.string().max(60).catch(""),
  synonyms: z.array(z.string().max(40)).max(8).catch([]),
  antonyms: z.array(z.string().max(40)).max(8).catch([]),
  collocations: z.array(z.string().max(60)).max(8).catch([]),
  pastSimple: z.string().max(40).nullable().catch(null),
  pastParticiple: z.string().max(40).nullable().catch(null),
});
export type FlashcardDraft = z.infer<typeof flashcardDraftSchema>;

export const reportSchema = z.object({
  summary: z.string().max(600).catch(""),
  vocabulary: z.array(z.string().max(200)).max(5).catch([]),
  grammar: z.array(z.string().max(200)).max(5).catch([]),
  pronunciation: z.array(z.string().max(200)).max(5).catch([]),
  fluency: z.array(z.string().max(200)).max(5).catch([]),
  newVocabulary: z.array(z.object({ word: z.string().max(40), meaning: z.string().max(120) })).max(10).catch([]),
  estimatedLevel: z.enum(LEVEL_VALUES).catch("A2"),
  levelPlus: z.boolean().catch(false),
  tips: z.array(z.string().max(200)).max(4).catch([]),
});
export type ConversationReport = z.infer<typeof reportSchema>;

export const levelEstimateSchema = z.object({
  level: z.enum(LEVEL_VALUES),
  plus: z.boolean().catch(false),
  rationale: z.string().max(400).catch(""),
});

export const exerciseSchema = z.object({
  exercises: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("choose"), prompt: z.string(), options: z.array(z.string()).min(2).max(5), answer: z.string(), explain: z.string().catch("") }),
      z.object({ type: z.literal("complete"), prompt: z.string(), answers: z.array(z.string()).min(1), explain: z.string().catch("") }),
      z.object({ type: z.literal("correct"), prompt: z.string(), answers: z.array(z.string()).min(1), explain: z.string().catch("") }),
      z.object({ type: z.literal("translate"), prompt: z.string(), answers: z.array(z.string()).min(1), explain: z.string().catch("") }),
    ]),
  ).min(1).max(15),
});

export const vocabListSchema = z.object({
  words: z.array(z.object({
    word: z.string().max(60), translation: z.string().max(120), pos: z.enum(POS_VALUES).catch("NOUN"),
    level: z.enum(LEVEL_VALUES).catch("B1"), example: z.string().max(240).catch(""), exampleTranslation: z.string().max(240).catch(""),
  })).min(1).max(30),
});

export const wordExplainSchema = z.object({ text: z.string().max(800) });
