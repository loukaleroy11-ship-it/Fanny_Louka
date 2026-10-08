import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { AIService } from "@/lib/ai/service";
import { buildTeacherContext } from "@/lib/ai/context";
import { recordMistakes } from "@/lib/mistakes";
import { recordActivity } from "@/lib/progress";
import { countWords } from "@/lib/normalize";

const schema = z.object({
  content: z.string().trim().min(1, "Message vide").max(1500),
  viaVoice: z.boolean().default(false),
  sttConfidence: z.number().min(0).max(1).optional(),
});

export const POST = route<{ id: string }>(
  async ({ req, user, params }) => {
    const input = await body(req, schema);
    const conv = await db.conversation.findFirst({ where: { id: params.id, userId: user.id } });
    if (!conv) throw new ApiError(404, "Conversation not found");
    if (conv.endedAt) throw new ApiError(409, "Cette conversation est terminée.");

    const history = await db.conversationMessage.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "asc" }, take: 40 });
    const ctx = { ...(await buildTeacherContext(user.id)), englishOnly: conv.englishOnly };
    const turn = await AIService.generateConversationResponse(ctx, {
      scenarioId: conv.scenario,
      history: history.map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content })),
      userMessage: input.content,
    });

    const corrections = turn.data.corrections;
    const userMsg = await db.conversationMessage.create({
      data: {
        conversationId: conv.id, role: "USER", content: input.content, viaVoice: input.viaVoice,
        sttConfidence: input.sttConfidence ?? null, correction: corrections.length ? corrections : undefined,
      },
    });
    const assistant = await db.conversationMessage.create({ data: { conversationId: conv.id, role: "ASSISTANT", content: turn.data.reply } });

    const mistakes = corrections.length
      ? await recordMistakes(
          user.id,
          corrections.map((c) => ({ original: c.original, corrected: c.corrected, explanation: c.explanation, category: c.category, skillSlug: c.skill })),
          "CONVERSATION",
          { conversationId: conv.id, autoCard: user.autoAddMistakes },
        )
      : [];

    const words = countWords(input.content);
    await db.conversation.update({ where: { id: conv.id }, data: { wordsSpoken: { increment: words }, mock: conv.mock || turn.mock } });
    const progress = await recordActivity(user.id, { xp: 3 + Math.min(5, Math.floor(words / 6)) });

    return ok({
      userMessage: { ...userMsg, correction: corrections },
      assistantMessage: assistant,
      mistakes: mistakes.map((m) => ({ id: m.id, flashcardId: m.flashcardId })),
      newWords: turn.data.newWords,
      mock: turn.mock,
      warning: turn.warning,
      progress,
    });
  },
  { ai: true },
);

// AI calls can take a while on serverless hosts (Vercel default is 10 s)
export const maxDuration = 60;
