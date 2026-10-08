import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { levelEnum } from "@/lib/validation";
import { levelIndex, SKILL_AREAS, valueOfLevel } from "@/lib/levels";
import { setEstimate } from "@/lib/skills";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  goal: z.string().trim().max(120).optional(),
  level: levelEnum.optional(),
  dailyMinutes: z.number().int().refine((n) => [5, 10, 15, 20, 30, 45, 60].includes(n), "Invalid daily goal").optional(),
  dailyNewCards: z.number().int().min(0).max(100).optional(),
  dailyReviewCards: z.number().int().min(0).max(500).optional(),
  dailyConversations: z.number().int().min(0).max(10).optional(),
  accent: z.enum(["US", "UK"]).optional(),
  voiceGender: z.enum(["female", "male"]).optional(),
  speechRate: z.number().min(0.5).max(2).optional(),
  englishOnly: z.boolean().optional(),
  autoAddMistakes: z.boolean().optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  desiredRetention: z.number().min(0.8).max(0.97).optional(),
  timezone: z.string().max(60).optional(),
});

export const PATCH = route(async ({ req, user }) => {
  const input = await body(req, schema);
  if (input.englishOnly && levelIndex(input.level ?? user.level) < levelIndex("B1")) {
    throw new ApiError(400, "Le mode English Only est disponible à partir du niveau B1.");
  }
  if (input.timezone) {
    try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { throw new ApiError(400, "Invalid timezone"); }
  }
  // lowering the level below B1 switches English Only off
  const forceOff = input.level && levelIndex(input.level) < levelIndex("B1") ? { englishOnly: false } : {};
  // Manually setting the level re-anchors every skill estimate on it; from there the level evolves with performance.
  if (input.level && input.level !== user.level) for (const area of SKILL_AREAS) await setEstimate(user.id, area, valueOfLevel(input.level), 0);
  const updated = await db.user.update({ where: { id: user.id }, data: { ...input, ...forceOff }, omit: { passwordHash: true } });
  return ok({ user: updated });
});

export const DELETE = route(async ({ user }) => {
  await db.user.delete({ where: { id: user.id } });
  return ok({ ok: true });
});
