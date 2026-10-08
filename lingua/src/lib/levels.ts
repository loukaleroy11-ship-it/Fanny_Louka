import type { Level, SkillArea } from "@prisma/client";

export const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Continuous scale: 0 = bottom of A1 … 6 = top of C2. Level index = floor(value). */
export const clampValue = (v: number) => Math.min(5.99, Math.max(0, v));

export function levelOf(v: number): Level {
  return LEVELS[Math.floor(clampValue(v))];
}

/** "A2" or "A2+" when the learner is in the upper half of the band. */
export function levelLabel(v: number): string {
  const c = clampValue(v);
  const base = LEVELS[Math.floor(c)];
  return c - Math.floor(c) >= 0.5 ? `${base}+` : base;
}

/** Default estimate for a declared level: lower quarter of the band, so a fresh A1 reads "A1" (not "A1+"). */
export const valueOfLevel = (l: Level) => LEVELS.indexOf(l) + 0.25;
export const levelIndex = (l: Level) => LEVELS.indexOf(l);

export const SKILL_AREAS: SkillArea[] = ["VOCABULARY", "GRAMMAR", "READING", "LISTENING", "WRITING", "SPEAKING"];

export const SKILL_LABEL: Record<SkillArea, string> = {
  VOCABULARY: "Vocabulary",
  GRAMMAR: "Grammar",
  READING: "Reading",
  LISTENING: "Listening",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

const WEIGHTS: Record<SkillArea, number> = {
  VOCABULARY: 1.2,
  GRAMMAR: 1.2,
  READING: 0.8,
  LISTENING: 0.8,
  WRITING: 0.8,
  SPEAKING: 1.2,
};

/** Weighted mean of the skill estimates that have evidence (all if none has any). */
export function overallValue(est: { area: SkillArea; value: number; evidence: number }[]): number {
  const withEv = est.filter((e) => e.evidence > 0);
  const src = withEv.length ? withEv : est;
  if (!src.length) return 0.5;
  let num = 0;
  let den = 0;
  for (const e of src) {
    num += e.value * WEIGHTS[e.area];
    den += WEIGHTS[e.area];
  }
  return num / den;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Probability of a correct answer for ability θ on an item of difficulty d (3PL-like, with guessing). */
export function pCorrect(theta: number, difficulty: number, guess = 0.25) {
  return guess + (1 - guess) * sigmoid(1.7 * (theta - difficulty));
}

/** Maximum-a-posteriori ability estimate on a 0..6 grid with a weak Gaussian prior. */
export function estimateAbility(
  responses: { difficulty: number; correct: boolean }[],
  prior = { mean: 1.5, sd: 2 },
  guess = 0.25,
): number {
  if (!responses.length) return prior.mean;
  let best = prior.mean;
  let bestLL = -Infinity;
  for (let t = 0; t <= 6.0001; t += 0.05) {
    let ll = -((t - prior.mean) ** 2) / (2 * prior.sd ** 2);
    for (const r of responses) {
      const p = pCorrect(t, r.difficulty, guess);
      ll += Math.log(r.correct ? p : 1 - p);
    }
    if (ll > bestLL) {
      bestLL = ll;
      best = t;
    }
  }
  return Math.min(5.9, Math.max(0.1, best));
}

/** Incremental Elo-style update used after each piece of evidence (review, exercise, conversation). */
export function updateSkillValue(
  old: number,
  evidence: number,
  difficulty: number,
  correct: boolean,
  guess = 0.1,
): number {
  const expected = pCorrect(old, difficulty, guess);
  const k = Math.max(0.03, 0.5 / Math.sqrt(1 + evidence / 4));
  return Math.min(5.95, Math.max(0.05, old + k * ((correct ? 1 : 0) - expected)));
}
