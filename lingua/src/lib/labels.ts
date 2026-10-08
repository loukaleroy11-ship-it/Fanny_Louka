import type { PartOfSpeech } from "@prisma/client";

/** UI-level "grammatical function" filter → PartOfSpeech enum values. */
export const FUNCTION_FILTERS = {
  noun: ["NOUN"],
  verb: ["VERB"],
  adjective: ["ADJECTIVE"],
  adverb: ["ADVERB"],
  pronoun: ["PRONOUN"],
  preposition: ["PREPOSITION"],
  conjunction: ["CONJUNCTION"],
  determiner: ["DETERMINER"],
  auxiliary: ["AUXILIARY"],
  modal: ["MODAL"],
  phrasal: ["PHRASAL_VERB"],
  expression: ["EXPRESSION"],
  interjection: ["INTERJECTION"],
} as const satisfies Record<string, readonly PartOfSpeech[]>;

export type FunctionKey = keyof typeof FUNCTION_FILTERS;

export const FUNCTION_LABEL: Record<FunctionKey, string> = {
  noun: "Nouns",
  verb: "Verbs",
  adjective: "Adjectives",
  adverb: "Adverbs",
  pronoun: "Pronouns",
  preposition: "Prepositions",
  conjunction: "Conjunctions",
  determiner: "Determiners",
  auxiliary: "Auxiliary verbs",
  modal: "Modal verbs",
  phrasal: "Phrasal verbs",
  expression: "Expressions",
  interjection: "Interjections",
};

export const POS_LABEL: Record<PartOfSpeech, string> = {
  NOUN: "Noun",
  VERB: "Verb",
  ADJECTIVE: "Adjective",
  ADVERB: "Adverb",
  PRONOUN: "Pronoun",
  PREPOSITION: "Preposition",
  CONJUNCTION: "Conjunction",
  DETERMINER: "Determiner",
  AUXILIARY: "Auxiliary verb",
  MODAL: "Modal verb",
  PHRASAL_VERB: "Phrasal verb",
  EXPRESSION: "Expression",
  INTERJECTION: "Interjection",
};

