import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { lessonBySlug } from "@/content/grammar";
import { answerMatches } from "@/lib/normalize";
import { addEvidence, recordSkillResult, refreshLevel } from "@/lib/skills";
import { recordMistakes } from "@/lib/mistakes";
import { recordActivity } from "@/lib/progress";
import { LEVEL_DIFFICULTY } from "@/content/placement";
import { AIService } from "@/lib/ai/service";
import { rateLimit, AI_LIMIT } from "@/lib/ratelimit";

const schema = z.object({
  lessonSlug: z.string().max(60),
  exerciseId: z.string().max(40),
  answer: z.string().max(400),
  /** set on the last exercise to trigger the perfect-lesson achievement */
  perfect: z.boolean().optional(),
});

/** Checks one exercise answer server-side (answers never ship to the browser). */
export const POST = route(
  async ({ req, user }) => {
    const { lessonSlug, exerciseId, answer, perfect } = await body(req, schema);
    const lesson = lessonBySlug(lessonSlug);
    const ex = lesson?.exercises.find((e) => e.id === exerciseId);
    if (!lesson || !ex) throw new ApiError(404, "Exercise not found");

    let correct = false;
    let expected: string | null = null;
    let explain = "explain" in ex ? ex.explain ?? "" : "";
    let mock: boolean | undefined;
    let extra: { corrected?: string } = {};

    switch (ex.type) {
      case "choose":
        correct = answer === ex.answer;
        expected = ex.answer;
        break;
      case "complete":
      case "translate":
      case "correct":
        correct = answerMatches(answer, ex.answers);
        expected = ex.answers[0];
        break;
      case "listen":
        correct = answerMatches(answer, [ex.sentence]);
        expected = ex.sentence;
        break;
      case "create": {
        // Only free-text sentences may reach the LLM, so only they count against the AI rate limit.
        const rl = rateLimit(`ai:${user.id}`, AI_LIMIT());
        if (!rl.ok) throw new ApiError(429, `Too many AI requests. Retry in ${rl.retryAfter}s.`);
        const words = answer.trim().split(/\s+/).length;
        const pattern = new RegExp(ex.pattern, "i").test(answer);
        const check = await AIService.detectMistake({ englishOnly: user.englishOnly }, answer);
        mock = check.mock;
        correct = pattern && words >= 4 && check.data.length === 0;
        expected = ex.example;
        if (check.data.length) {
          extra = { corrected: check.data[0].corrected };
          explain = check.data[0].explanation;
        } else if (!pattern) explain = "La phrase n'utilise pas la structure demandée.";
        else if (words < 4) explain = "Écrivez une phrase complète (au moins 4 mots).";
        break;
      }
    }

    await db.exerciseResult.create({ data: { userId: user.id, lessonSlug, exerciseId, type: ex.type, correct, answer: answer.slice(0, 400), skillSlug: lesson.skillSlug } });
    await addEvidence(user.id, ex.type === "listen" ? "LISTENING" : "GRAMMAR", LEVEL_DIFFICULTY[lesson.level], correct);
    if (correct || ex.type === "create") {
      await recordSkillResult(user.id, lesson.skillSlug, correct);
    } else {
      // Wrong answer → stored as a mistake (raises the skill priority) with full sentences so the
      // resulting flashcard makes sense on its own.
      const fill = (prompt: string, text: string) => prompt.replace("___", text).replace(/\s*\([^)]*\)/g, "").trim();
      let original = answer;
      let corrected = expected ?? "";
      if (ex.type === "choose" || ex.type === "complete") {
        original = fill(ex.prompt, answer);
        corrected = fill(ex.prompt, expected ?? "");
      } else if (ex.type === "correct") original = ex.prompt;
      await recordMistakes(
        user.id,
        [{ original, corrected, explanation: explain || `Voir la leçon « ${lesson.title} ».`, category: "GRAMMAR", skillSlug: lesson.skillSlug }],
        "EXERCISE",
        { autoCard: user.autoAddMistakes },
      );
    }
    const progress = await recordActivity(user.id, { exercises: 1, seconds: 20, xp: correct ? 4 : 1, perfectLesson: perfect && correct });
    if (perfect) await refreshLevel(user.id);
    return ok({ correct, expected, explain, ...extra, mock, progress });
  },
);

// AI calls can take a while on serverless hosts (Vercel default is 10 s)
export const maxDuration = 60;
