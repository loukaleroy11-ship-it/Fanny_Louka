export type LevelCode = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type Exercise =
  | { id: string; type: "choose"; prompt: string; options: string[]; answer: string; explain?: string }
  | { id: string; type: "complete"; prompt: string; answers: string[]; explain?: string }
  | { id: string; type: "translate"; prompt: string; answers: string[]; explain?: string }
  | { id: string; type: "correct"; prompt: string; answers: string[]; explain: string }
  | { id: string; type: "create"; prompt: string; pattern: string; example: string; explain?: string }
  | { id: string; type: "listen"; sentence: string; explain?: string };

export interface GrammarLesson {
  slug: string;
  skillSlug: string;
  title: string;
  titleFr: string;
  level: LevelCode;
  summary: string;
  whenToUse: { text: string; example: string; translation: string }[];
  structure: { affirmative: string; negative: string; question: string; shortAnswers?: string };
  auxiliary: string;
  forms: { label: string; en: string }[];
  examples: { en: string; fr: string }[];
  commonErrors: { wrong: string; right: string; why: string }[];
  signalWords: string[];
  tips: string[];
  exercises: Exercise[];
}

export interface GrammarSkillDef {
  slug: string;
  name: string;
  description: string;
  level: LevelCode;
  lessonSlug?: string;
}
