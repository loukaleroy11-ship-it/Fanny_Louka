import { route, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getEstimates, weakSkills } from "@/lib/skills";
import { levelLabel, levelOf, SKILL_LABEL } from "@/lib/levels";

/** Skill-by-skill CEFR estimate, gaps (weakest skills + recurring grammar problems) and next level. */
export const GET = route(async ({ user }) => {
  const est = await getEstimates(user.id);
  const weak = await weakSkills(user.id, 5);
  const skills = est.list.map((e) => ({ area: e.area, label: SKILL_LABEL[e.area], value: e.value, level: levelLabel(e.value), evidence: e.evidence }));
  const gaps = [...skills].filter((s) => s.evidence > 0 || true).sort((a, b) => a.value - b.value).slice(0, 2).map((s) => ({ area: s.area, label: s.label, level: s.level }));
  const all = await db.userSkill.findMany({ where: { userId: user.id }, include: { skill: true }, orderBy: { priority: "desc" } });
  const nextIdx = Math.min(5, Math.floor(est.overall) + 1);
  return ok({
    overall: { value: est.overall, label: levelLabel(est.overall), level: levelOf(est.overall), nextLevel: ["A1", "A2", "B1", "B2", "C1", "C2"][nextIdx], progressToNext: est.overall - Math.floor(est.overall) },
    skills, gaps,
    grammar: all.map((u) => ({ slug: u.skill.slug, name: u.skill.name, mastery: u.mastery, mistakes: u.mistakes, attempts: u.attempts, priority: u.priority })),
    recurring: weak.map((w) => ({ slug: w.skill.slug, name: w.skill.name, mistakes: w.mistakes, priority: w.priority, lessonSlug: w.skill.lessonSlug })),
  });
});
