import type { LevelCode } from "./types";

export type PlacementSection = "vocabulary" | "grammar" | "conjugation" | "reading";

export interface PlacementQuestion {
  id: string;
  section: PlacementSection;
  level: LevelCode;
  prompt: string;
  options: string[];
  answer: string;
  skillSlug?: string;
  passage?: string; // reading comprehension text, shared by consecutive questions
  passageId?: string;
  explain?: string;
}

export const SECTION_LABEL: Record<PlacementSection, string> = {
  vocabulary: "Vocabulaire",
  grammar: "Grammaire",
  conjugation: "Conjugaison",
  reading: "Compréhension",
};

const P1 = {
  passageId: "p1",
  passage:
    "Hi! My name is Sara. I am twelve. I live in a small house with my mother, my father and my dog, Max. Every morning I walk to school with my friend Tom. I like maths but I don't like history.",
};
const P2 = {
  passageId: "p2",
  passage:
    "Last Saturday, Paul wanted to go to the beach, but it was raining. So he stayed at home and cooked dinner for his friends. They arrived at seven o'clock and brought a cake. After dinner, they played cards until midnight.",
};
const P3 = {
  passageId: "p3",
  passage:
    "Many people think that working from home is easier than working in an office. However, a recent survey shows that most remote workers find it hard to separate their job from their private life. They often work longer hours and feel more tired than before.",
};
const P4 = {
  passageId: "p4",
  passage:
    "Although the new policy was intended to reduce traffic in the city centre, its effects have been rather mixed. Air quality has improved slightly; nevertheless, small businesses claim that fewer customers are visiting their shops, and several have warned they might have to close unless the rules are relaxed.",
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  // ── Vocabulary ──
  { id: "v1", section: "vocabulary", level: "A1", prompt: "A ___ is a person who teaches students.", options: ["doctor", "teacher", "driver", "farmer"], answer: "teacher" },
  { id: "v2", section: "vocabulary", level: "A1", prompt: "What is the opposite of \"hot\"?", options: ["cold", "big", "slow", "dark"], answer: "cold" },
  { id: "v3", section: "vocabulary", level: "A2", prompt: "I need to ___ the bus at the next stop.", options: ["catch", "hit", "hold", "break"], answer: "catch" },
  { id: "v4", section: "vocabulary", level: "A2", prompt: "\"Cheap\" means:", options: ["very expensive", "not expensive", "very old", "not clean"], answer: "not expensive" },
  { id: "v5", section: "vocabulary", level: "B1", prompt: "The meeting was ___ because the manager was ill.", options: ["cancelled", "occupied", "gathered", "prevented"], answer: "cancelled" },
  { id: "v6", section: "vocabulary", level: "B1", prompt: "He has a very good ___ of humour.", options: ["sense", "feeling", "mind", "sight"], answer: "sense" },
  { id: "v7", section: "vocabulary", level: "B2", prompt: "The company decided to ___ its prices to attract more customers.", options: ["slash", "swell", "stretch", "stack"], answer: "slash" },
  { id: "v8", section: "vocabulary", level: "C1", prompt: "Her ___ remarks offended several guests.", options: ["tactless", "tireless", "tasteful", "timeless"], answer: "tactless" },

  // ── Grammar ──
  { id: "g1", section: "grammar", level: "A1", prompt: "She ___ a new bike.", options: ["have", "has", "having", "haves"], answer: "has", skillSlug: "present-simple" },
  { id: "g2", section: "grammar", level: "A1", prompt: "There ___ three apples on the table.", options: ["is", "are", "be", "am"], answer: "are", skillSlug: "plurals" },
  { id: "g3", section: "grammar", level: "A2", prompt: "I'm interested ___ music.", options: ["on", "at", "in", "for"], answer: "in", skillSlug: "prepositions" },
  { id: "g4", section: "grammar", level: "A2", prompt: "This book is ___ than that one.", options: ["more interesting", "most interesting", "interestinger", "more interested"], answer: "more interesting", skillSlug: "comparatives" },
  { id: "g5", section: "grammar", level: "B1", prompt: "If it rains tomorrow, we ___ at home.", options: ["stay", "will stay", "would stay", "stayed"], answer: "will stay", skillSlug: "conditionals" },
  { id: "g6", section: "grammar", level: "B1", prompt: "You ___ wear a seatbelt. It's the law.", options: ["must", "might", "can", "would"], answer: "must", skillSlug: "modal-verbs" },
  { id: "g7", section: "grammar", level: "B2", prompt: "If I ___ more time, I would learn Japanese.", options: ["have", "had", "would have", "have had"], answer: "had", skillSlug: "conditionals" },
  { id: "g8", section: "grammar", level: "C1", prompt: "Not only ___ late, but he also forgot the documents.", options: ["he was", "was he", "he is", "is he"], answer: "was he", skillSlug: "word-order" },

  // ── Conjugation ──
  { id: "c1", section: "conjugation", level: "A1", prompt: "He ___ to school every day.", options: ["go", "goes", "going", "gone"], answer: "goes", skillSlug: "present-simple" },
  { id: "c2", section: "conjugation", level: "A1", prompt: "They ___ playing football now.", options: ["is", "am", "are", "be"], answer: "are", skillSlug: "present-continuous" },
  { id: "c3", section: "conjugation", level: "A2", prompt: "Yesterday we ___ a great film.", options: ["see", "saw", "seen", "seed"], answer: "saw", skillSlug: "past-simple" },
  { id: "c4", section: "conjugation", level: "A2", prompt: "___ you finish your homework last night?", options: ["Do", "Did", "Have", "Are"], answer: "Did", skillSlug: "past-simple" },
  { id: "c5", section: "conjugation", level: "B1", prompt: "I ___ in Lyon since 2018.", options: ["live", "lived", "have lived", "am living"], answer: "have lived", skillSlug: "present-perfect" },
  { id: "c6", section: "conjugation", level: "B1", prompt: "Look at the clouds! It ___ rain.", options: ["will", "is going to", "rains", "is raining"], answer: "is going to", skillSlug: "future-forms" },
  { id: "c7", section: "conjugation", level: "B2", prompt: "When I arrived, they ___ dinner.", options: ["have", "had", "were having", "are having"], answer: "were having", skillSlug: "past-simple" },
  { id: "c8", section: "conjugation", level: "C1", prompt: "By next year, she ___ here for a decade.", options: ["will work", "will have worked", "has worked", "is working"], answer: "will have worked", skillSlug: "present-perfect" },

  // ── Reading comprehension ──
  { id: "r1", section: "reading", level: "A1", ...P1, prompt: "Who does Sara walk to school with?", options: ["Her mother", "Her dog", "Tom", "Her father"], answer: "Tom" },
  { id: "r2", section: "reading", level: "A1", ...P1, prompt: "Which subject does Sara NOT like?", options: ["Maths", "History", "English", "Art"], answer: "History" },
  { id: "r3", section: "reading", level: "A2", ...P2, prompt: "Why did Paul stay at home?", options: ["He was ill", "It was raining", "He had no friends", "He was at work"], answer: "It was raining" },
  { id: "r4", section: "reading", level: "A2", ...P2, prompt: "What did the friends bring?", options: ["Cards", "Dinner", "A cake", "Drinks"], answer: "A cake" },
  { id: "r5", section: "reading", level: "B1", ...P3, prompt: "According to the survey, remote workers…", options: ["are less tired", "have more free time", "struggle to separate work and private life", "earn more money"], answer: "struggle to separate work and private life" },
  { id: "r6", section: "reading", level: "B1", ...P3, prompt: "The word \"However\" introduces…", options: ["an example", "a contrast", "a result", "a question"], answer: "a contrast" },
  { id: "r7", section: "reading", level: "B2", ...P4, prompt: "What do small businesses say about the policy?", options: ["It improved their sales", "It reduced customer numbers", "It was well explained", "It has no effect"], answer: "It reduced customer numbers" },
  { id: "r8", section: "reading", level: "B2", ...P4, prompt: "The writer describes the effects of the policy as…", options: ["entirely positive", "entirely negative", "mixed", "unknown"], answer: "mixed" },
];

/** Maps CEFR letters to the continuous scale used everywhere (0 = bottom of A1 … 6 = top of C2). */
export const LEVEL_DIFFICULTY: Record<LevelCode, number> = { A1: 0.5, A2: 1.5, B1: 2.5, B2: 3.5, C1: 4.5, C2: 5.5 };
