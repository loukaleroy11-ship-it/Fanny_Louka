import { z } from "zod";

export const levelEnum = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export const posEnum = z.enum([
  "NOUN", "VERB", "ADJECTIVE", "ADVERB", "PRONOUN", "PREPOSITION", "CONJUNCTION", "DETERMINER",
  "AUXILIARY", "MODAL", "PHRASAL_VERB", "EXPRESSION", "INTERJECTION",
]);

const text = (max: number) => z.string().trim().max(max);
const list = z.array(z.string().trim().min(1).max(60)).max(12);

export const cardInputSchema = z.object({
  word: text(120).min(1, "English word required"),
  translation: text(200).min(1, "French translation required"),
  example: text(400).optional().default(""),
  exampleTranslation: text(400).optional().default(""),
  definition: text(400).optional().default(""),
  pos: posEnum,
  level: levelEnum,
  ipa: text(60).optional().default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),
  synonyms: list.optional().default([]),
  antonyms: list.optional().default([]),
  collocations: list.optional().default([]),
  pastSimple: text(40).nullish(),
  pastParticiple: text(40).nullish(),
  deckId: z.string().optional(),
  /** true once the learner confirmed "Create anyway" after the duplicate warning */
  force: z.boolean().optional().default(false),
});
export type CardInput = z.infer<typeof cardInputSchema>;

/** PATCH body: every field optional, *no defaults* (an absent field must stay untouched). */
export const cardPatchSchema = z.object({
  word: text(120).min(1),
  translation: text(200).min(1),
  example: text(400),
  exampleTranslation: text(400),
  definition: text(400),
  pos: posEnum,
  level: levelEnum,
  ipa: text(60),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  synonyms: list,
  antonyms: list,
  collocations: list,
  pastSimple: text(40).nullish(),
  pastParticiple: text(40).nullish(),
  note: z.string().max(500).nullish(),
  suspended: z.boolean(),
  deckIds: z.array(z.string()).max(30),
}).partial();

export const passwordSchema = z.string().min(8, "8 caractères minimum").max(128);
export const emailSchema = z.string().trim().toLowerCase().email("Email invalide").max(200);
