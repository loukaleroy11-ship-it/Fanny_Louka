import type { SkillArea } from "@prisma/client";
import { db } from "./db";
import { SKILL_AREAS, overallValue, levelOf, updateSkillValue, valueOfLevel } from "./levels";

/** Returns the 6 skill estimates (defaults filled in) and the overall value. */
export async function getEstimates(userId: string) {
  const [rows, user] = await Promise.all([
    db.skillEstimate.findMany({ where: { userId } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } }),
  ]);
  const list = SKILL_AREAS.map((area) => {
    const r = rows.find((x) => x.area === area);
    return { area, value: r?.value ?? valueOfLevel(user.level), evidence: r?.evidence ?? 0 };
  });
  return { list, overall: overallValue(list) };
}

/** Adds one piece of evidence to a skill area and refreshes the learner's overall CEFR level. */
export async function addEvidence(userId: string, area: SkillArea, difficulty: number, correct: boolean) {
  const cur = await db.skillEstimate.findUnique({ where: { userId_area: { userId, area } } });
  const start = cur?.value ?? valueOfLevel((await db.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } })).level);
  const value = updateSkillValue(start, cur?.evidence ?? 0, difficulty, correct);
  await db.skillEstimate.upsert({
    where: { userId_area: { userId, area } },
    update: { value, evidence: { increment: 1 } },
    create: { userId, area, value, evidence: 1 },
  });
}

/** Sets a skill estimate outright (used by the placement test). */
export async function setEstimate(userId: string, area: SkillArea, value: number, evidence: number) {
  await db.skillEstimate.upsert({
    where: { userId_area: { userId, area } },
    update: { value, evidence },
    create: { userId, area, value, evidence },
  });
}

/** Recomputes and stores the learner's overall CEFR level. Returns the previous and new level. */
export async function refreshLevel(userId: string) {
  const { overall } = await getEstimates(userId);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } });
  const level = levelOf(overall);
  if (level !== user.level) await db.user.update({ where: { id: userId }, data: { level } });
  return { previous: user.level, level, overall, changed: level !== user.level };
}

/**
 * Records the outcome of one attempt on a grammar skill.
 * `priority` goes up by 1 per mistake and down by 0.35 per success: skills a learner keeps failing
 * float to the top of the daily plan and of the AI teacher's context.
 */
export async function recordSkillResult(userId: string, skillSlug: string | null | undefined, correct: boolean) {
  if (!skillSlug) return;
  const skill = await db.grammarSkill.findUnique({ where: { slug: skillSlug }, select: { id: true } });
  if (!skill) return;
  const cur = await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId: skill.id } } });
  const mastery = (cur?.mastery ?? 0.5) * 0.8 + (correct ? 1 : 0) * 0.2;
  const priority = Math.max(0, (cur?.priority ?? 0) + (correct ? -0.35 : 1));
  await db.userSkill.upsert({
    where: { userId_skillId: { userId, skillId: skill.id } },
    update: {
      attempts: { increment: 1 },
      correct: { increment: correct ? 1 : 0 },
      mistakes: { increment: correct ? 0 : 1 },
      mastery,
      priority,
    },
    create: { userId, skillId: skill.id, attempts: 1, correct: correct ? 1 : 0, mistakes: correct ? 0 : 1, mastery, priority },
  });
}

/** Skills ordered by priority (recurring weaknesses first). */
export async function weakSkills(userId: string, take = 5) {
  return db.userSkill.findMany({
    where: { userId, priority: { gt: 0.5 } },
    orderBy: [{ priority: "desc" }, { mastery: "asc" }],
    take,
    include: { skill: true },
  });
}

/** Moves a skill estimate toward an observed value (e.g. the level shown by a whole conversation). */
export async function blendEstimate(userId: string, area: SkillArea, observed: number) {
  const cur = await db.skillEstimate.findUnique({ where: { userId_area: { userId, area } } });
  const start = cur?.value ?? (await getEstimates(userId)).list.find((e) => e.area === area)!.value;
  const evidence = cur?.evidence ?? 0;
  const w = Math.max(0.12, 0.5 / Math.sqrt(1 + evidence / 3));
  const value = Math.min(5.95, Math.max(0.05, start + w * (observed - start)));
  await db.skillEstimate.upsert({
    where: { userId_area: { userId, area } },
    update: { value, evidence: { increment: 1 } },
    create: { userId, area, value, evidence: 1 },
  });
}
