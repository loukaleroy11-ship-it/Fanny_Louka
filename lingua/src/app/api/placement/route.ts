import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { LEVEL_DIFFICULTY, PLACEMENT_QUESTIONS, type PlacementSection } from "@/content/placement";
import { estimateAbility, levelLabel, levelOf, overallValue } from "@/lib/levels";
import { setEstimate, recordSkillResult, refreshLevel } from "@/lib/skills";
import { recordMistakes } from "@/lib/mistakes";
import { recordActivity, unlock } from "@/lib/progress";
import type { SkillArea } from "@prisma/client";

/** Questions without the answers. */
export const GET = route(async () =>
  ok({ questions: PLACEMENT_QUESTIONS.map(({ answer: _a, explain: _e, ...q }) => q) }, { headers: { "Cache-Control": "private, max-age=3600" } }),
);

const schema = z.object({ answers: z.record(z.string(), z.string().max(200)) });

const AREA: Record<PlacementSection, SkillArea> = { vocabulary: "VOCABULARY", grammar: "GRAMMAR", conjugation: "GRAMMAR", reading: "READING" };

export const POST = route(async ({ req, user }) => {
  const { answers } = await body(req, schema);
  const bySection: Record<string, { difficulty: number; correct: boolean }[]> = {};
  const byArea: Record<string, { difficulty: number; correct: boolean }[]> = {};
  const wrong: { original: string; corrected: string; explanation: string; skillSlug: string | null }[] = [];
  const sections: Record<string, { correct: number; total: number }> = {};

  for (const q of PLACEMENT_QUESTIONS) {
    const given = answers[q.id];
    const correct = given === q.answer;
    const d = LEVEL_DIFFICULTY[q.level];
    (bySection[q.section] ??= []).push({ difficulty: d, correct });
    (byArea[AREA[q.section]] ??= []).push({ difficulty: d, correct });
    const s = (sections[q.section] ??= { correct: 0, total: 0 });
    s.total++;
    if (correct) s.correct++;
    if (!correct && given && q.skillSlug && q.section !== "vocabulary") {
      wrong.push({ original: q.prompt.replace("___", given), corrected: q.prompt.replace("___", q.answer), explanation: `Réponse attendue : « ${q.answer} ».`, skillSlug: q.skillSlug });
    }
  }

  const estimates = (["VOCABULARY", "GRAMMAR", "READING"] as SkillArea[]).map((area) => ({
    area, value: estimateAbility(byArea[area]), evidence: byArea[area].length,
  }));
  for (const e of estimates) await setEstimate(user.id, e.area, e.value, e.evidence);
  // Placement says nothing about listening/speaking/writing yet: start them slightly below the overall estimate.
  const base = overallValue(estimates);
  for (const area of ["LISTENING", "SPEAKING", "WRITING"] as SkillArea[]) await setEstimate(user.id, area, Math.max(0.3, base - 0.3), 0);

  const overall = overallValue(estimates);
  const level = levelOf(overall);
  await db.user.update({ where: { id: user.id }, data: { level, placementDone: true } });
  await db.learningSession.create({ data: { userId: user.id, kind: "PLACEMENT", endedAt: new Date(), items: PLACEMENT_QUESTIONS.length, correct: Object.values(sections).reduce((n, s) => n + s.correct, 0), meta: { sections, overall } } });
  if (wrong.length) await recordMistakes(user.id, wrong.map((w) => ({ ...w, category: "GRAMMAR" as const })), "PLACEMENT");
  await unlock(user.id, "placement");
  await recordActivity(user.id, { xp: 25 });
  await refreshLevel(user.id);

  return ok({
    estimatedLevel: levelLabel(overall),
    level,
    overall,
    sections: Object.entries(sections).map(([section, s]) => ({
      section, ...s, level: levelLabel(estimateAbility(bySection[section])),
    })),
    skills: estimates.map((e) => ({ area: e.area, level: levelLabel(e.value) })),
  });
});
