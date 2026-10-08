import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { AIService } from "@/lib/ai/service";
import { buildTeacherContext } from "@/lib/ai/context";
import { randomScenario, scenarioById, SCENARIOS } from "@/content/scenarios";
import { levelIndex } from "@/lib/levels";

const schema = z.object({ scenario: z.string().max(40) });

export const GET = route(async ({ user }) => {
  const list = await db.conversation.findMany({
    where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 20,
    select: { id: true, scenario: true, level: true, startedAt: true, endedAt: true, durationSec: true, wordsSpoken: true, mock: true },
  });
  return ok({ conversations: list, ai: { mock: AIService.isMock() }, scenarios: SCENARIOS.map(({ id, label, emoji, setup }) => ({ id, label, emoji, setup })) });
});

export const POST = route(
  async ({ req, user }) => {
    const { scenario } = await body(req, schema);
    const sc = scenario === "surprise" ? randomScenario() : (scenarioById(scenario) ?? SCENARIOS[0]);
    const englishOnly = user.englishOnly && levelIndex(user.level) >= levelIndex("B1");
    const ctx = { ...(await buildTeacherContext(user.id)), englishOnly };
    const turn = await AIService.generateConversationResponse(ctx, { scenarioId: sc.id, history: [], userMessage: null });
    const conv = await db.conversation.create({
      data: { userId: user.id, scenario: sc.id, level: user.level, englishOnly, mock: turn.mock },
    });
    const opener = await db.conversationMessage.create({ data: { conversationId: conv.id, role: "ASSISTANT", content: turn.data.reply } });
    return ok({ conversation: { id: conv.id, scenario: sc.id, label: sc.label, emoji: sc.emoji, englishOnly, mock: turn.mock }, messages: [opener], warning: turn.warning }, { status: 201 });
  },
  { ai: true },
);

// AI calls can take a while on serverless hosts (Vercel default is 10 s)
export const maxDuration = 60;
