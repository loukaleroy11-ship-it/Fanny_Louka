import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { compareSentences, PASS_LISTEN, PASS_REPEAT } from "@/lib/oral";
import { addEvidence, refreshLevel } from "@/lib/skills";
import { recordActivity } from "@/lib/progress";
import { LEVEL_DIFFICULTY } from "@/content/placement";

const schema = z.object({
  mode: z.enum(["listen", "repeat"]),
  target: z.string().trim().min(2).max(200),
  heard: z.string().trim().max(300),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).default("A2"),
  confidence: z.number().min(0).max(1).optional(),
  slow: z.boolean().optional(),
  last: z.boolean().optional(),
});

/**
 * Scores one oral exercise. "listen" = dictation (comprehension → Listening estimate);
 * "repeat" = the learner says the sentence, the browser transcribes it, we compare (expression → Speaking estimate).
 * Note: this measures intelligibility to a speech recogniser, not true pronunciation quality.
 */
export const POST = route(async ({ req, user }) => {
  const i = await body(req, schema);
  const r = compareSentences(i.target, i.heard);
  const pass = r.score >= (i.mode === "listen" ? PASS_LISTEN : PASS_REPEAT);
  await db.exerciseResult.create({ data: { userId: user.id, lessonSlug: `oral-${i.mode}`, exerciseId: i.target.slice(0, 40), type: i.mode, correct: pass, answer: i.heard.slice(0, 300), skillSlug: null } });
  await addEvidence(user.id, i.mode === "listen" ? "LISTENING" : "SPEAKING", LEVEL_DIFFICULTY[i.level], pass);
  const progress = await recordActivity(user.id, { oral: 1, seconds: 15, xp: pass ? 5 : 2 });
  if (i.last) await refreshLevel(user.id);
  return ok({ score: r.score, pass, marks: r.marks, missed: r.missed, extra: r.extra, progress });
});
