import { route, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { AIService } from "@/lib/ai/service";
import { buildTeacherContext } from "@/lib/ai/context";
import { blendEstimate, refreshLevel } from "@/lib/skills";
import { recordActivity } from "@/lib/progress";
import { countWords } from "@/lib/normalize";

/** Closes a conversation and builds the report (duration, words, corrections, new vocabulary, level). */
export const POST = route<{ id: string }>(
  async ({ user, params }) => {
    const conv = await db.conversation.findFirst({ where: { id: params.id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!conv) throw new ApiError(404, "Conversation not found");
    if (conv.endedAt && conv.report) return ok({ report: conv.report });

    const userMsgs = conv.messages.filter((m) => m.role === "USER");
    if (!userMsgs.length) {
      await db.conversation.delete({ where: { id: conv.id } });
      return ok({ report: null, discarded: true });
    }
    // Active time = sum of gaps between messages, each capped at 2 minutes (idle time doesn't count).
    let durationSec = 0;
    for (let i = 1; i < conv.messages.length; i++) durationSec += Math.min(120, (conv.messages[i].createdAt.getTime() - conv.messages[i - 1].createdAt.getTime()) / 1000);
    durationSec = Math.max(30, Math.round(durationSec));

    const corrections = userMsgs.reduce((n, m) => n + (Array.isArray(m.correction) ? m.correction.length : 0), 0);
    const wordsSpoken = userMsgs.reduce((n, m) => n + countWords(m.content), 0);
    const ctx = { ...(await buildTeacherContext(user.id)), englishOnly: conv.englishOnly };
    const analysis = await AIService.analyzeConversation(
      ctx,
      conv.messages.map((m) => ({
        role: m.role, content: m.content,
        corrected: Array.isArray(m.correction) && m.correction.length > 0,
        lowConfidence: m.viaVoice && m.sttConfidence !== null && m.sttConfidence < 0.8,
      })),
    );
    const a = analysis.data;
    const report = {
      durationSec, wordsSpoken, corrections, messages: userMsgs.length,
      newVocabulary: a.newVocabulary, estimatedLevel: a.estimatedLevel, levelPlus: a.levelPlus,
      mainMistakes: { vocabulary: a.vocabulary, grammar: a.grammar, pronunciation: a.pronunciation, fluency: a.fluency },
      summary: a.summary, tips: a.tips, mock: analysis.mock, englishOnly: conv.englishOnly,
    };
    await db.conversation.update({ where: { id: conv.id }, data: { endedAt: new Date(), durationSec, wordsSpoken, report, mock: conv.mock || analysis.mock } });

    // Evidence for the skill estimates: the conversation's estimated level feeds Speaking (voice) and Writing (typed).
    const observed = ["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(a.estimatedLevel) + (a.levelPlus ? 0.75 : 0.35);
    const voice = userMsgs.filter((m) => m.viaVoice).length;
    if (voice > 0) await blendEstimate(user.id, "SPEAKING", observed);
    if (userMsgs.length - voice > 0) await blendEstimate(user.id, "WRITING", observed);
    const progress = await recordActivity(user.id, { conversations: 1, convSeconds: durationSec, seconds: 0, xp: 30 });
    const level = await refreshLevel(user.id);
    return ok({ report, progress, levelChanged: level.changed ? { from: level.previous, to: level.level } : null });
  },
  { ai: true },
);
