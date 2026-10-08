import { db } from "../db";
import { getEstimates, weakSkills } from "../skills";
import { levelLabel, SKILL_LABEL } from "../levels";

/** Everything the AI teacher is allowed to know about a learner — assembled server-side for each call. */
export interface TeacherContext {
  name: string;
  level: string; // CEFR band e.g. "A2"
  levelLabel: string; // e.g. "A2+"
  goal: string;
  englishOnly: boolean;
  accent: "US" | "UK";
  skills: { area: string; level: string }[];
  weakGrammar: { name: string; mistakes: number }[];
  recentMistakes: { original: string; corrected: string }[];
  knownWords: string[]; // mastered
  studyingWords: string[]; // seen but not yet mastered
  hardWords: string[]; // to be re-used naturally in conversation
  recentScenarios: string[];
}

export async function buildTeacherContext(userId: string): Promise<TeacherContext> {
  const [user, est, weak, mistakes, mastered, studying, hard, convs] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, level: true, goal: true, englishOnly: true, accent: true } }),
    getEstimates(userId),
    weakSkills(userId, 4),
    db.mistake.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { original: true, corrected: true } }),
    db.flashcard.findMany({ where: { userId, state: 2, stability: { gte: 21 }, origin: { not: "MISTAKE" } }, orderBy: { stability: "desc" }, take: 40, select: { vocabulary: { select: { word: true } } } }),
    db.flashcard.findMany({ where: { userId, reps: { gt: 0 }, origin: { not: "MISTAKE" }, stability: { lt: 21 } }, orderBy: { lastReview: "desc" }, take: 25, select: { vocabulary: { select: { word: true } } } }),
    db.flashcard.findMany({ where: { userId, reps: { gt: 0 }, origin: { not: "MISTAKE" }, OR: [{ lapses: { gte: 2 } }, { difficulty: { gte: 7 } }] }, orderBy: { lapses: "desc" }, take: 8, select: { vocabulary: { select: { word: true } } } }),
    db.conversation.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 3, select: { scenario: true } }),
  ]);
  return {
    name: user.name.split(" ")[0],
    level: user.level,
    levelLabel: levelLabel(est.overall),
    goal: user.goal,
    englishOnly: user.englishOnly,
    accent: user.accent,
    skills: est.list.map((e) => ({ area: SKILL_LABEL[e.area], level: levelLabel(e.value) })),
    weakGrammar: weak.map((w) => ({ name: w.skill.name, mistakes: w.mistakes })),
    recentMistakes: mistakes,
    knownWords: mastered.map((c) => c.vocabulary.word),
    studyingWords: studying.map((c) => c.vocabulary.word),
    hardWords: hard.map((c) => c.vocabulary.word),
    recentScenarios: convs.map((c) => c.scenario),
  };
}
