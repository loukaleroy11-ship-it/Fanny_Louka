/**
 * AIService — the single entry point to the "AI teacher". UI components and routes never build prompts
 * or call the LLM directly. Each method returns `{ data, mock }`: `mock: true` means the result came
 * from the rule-based demo mode (no API key), so the UI can say so honestly.
 */
import { z } from "zod";
import { db } from "../db";
import { normalizeWord } from "../normalize";
import { complete, extractJson, isMockMode, NoLLMError, type ChatMessage } from "./llm";
import * as P from "./prompts";
import * as S from "./schemas";
import { heuristicLevel, mockCorrect, mockReply } from "./mock";
import type { TeacherContext } from "./context";
import { scenarioById, SCENARIOS } from "../../content/scenarios";
import { GRAMMAR_LESSONS, lessonBySlug } from "../../content/grammar";
import { countWords } from "../normalize";

export interface AIResult<T> {
  data: T;
  mock: boolean;
  warning?: string;
}

/** Calls the LLM and validates the JSON reply with zod; retries once with a repair hint. */
async function jsonCall<T extends z.ZodTypeAny>(
  schema: T,
  system: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<z.infer<T>> {
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    const msgs = i === 0 ? messages : [...messages, { role: "assistant" as const, content: "(invalid)" }, { role: "user" as const, content: "Your previous reply was not valid JSON. Reply again with ONLY the JSON object." }];
    const text = await complete({ system, messages: msgs, ...opts });
    try {
      return schema.parse(extractJson(text));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Wraps an LLM implementation with a mock fallback (no key) and an error fallback (LLM failure). */
async function withFallback<T>(live: () => Promise<T>, mock: () => Promise<T> | T): Promise<AIResult<T>> {
  if (isMockMode()) return { data: await mock(), mock: true };
  try {
    return { data: await live(), mock: false };
  } catch (e) {
    if (!(e instanceof NoLLMError)) console.error("[ai] LLM call failed, using demo fallback:", e instanceof Error ? e.message : e);
    return { data: await mock(), mock: true, warning: "L'IA est momentanément indisponible : mode démo utilisé." };
  }
}

const trimHistory = (h: ChatMessage[]) => h.slice(-20).map((m) => ({ ...m, content: m.content.slice(0, 1000) }));

export const AIService = {
  isMock: isMockMode,

  /** Next teacher turn: reply + discreet corrections of the learner's last message. */
  async generateConversationResponse(
    ctx: TeacherContext,
    input: { scenarioId: string; history: ChatMessage[]; userMessage: string | null },
  ): Promise<AIResult<S.TurnResult>> {
    const sc = scenarioById(input.scenarioId) ?? SCENARIOS[0];
    const turn = input.history.filter((m) => m.role === "user").length + (input.userMessage ? 1 : 0);
    return withFallback<S.TurnResult>(
      async () => {
        const msgs: ChatMessage[] = trimHistory(input.history);
        msgs.push({ role: "user", content: input.userMessage ?? `[${P.openerInstruction}]` });
        const out = await jsonCall(S.turnSchema, P.teacherSystem(ctx, sc), msgs, { maxTokens: 500, temperature: 0.7 });
        return out;
      },
      () => {
        const corrections = input.userMessage ? mockCorrect(input.userMessage, ctx.englishOnly) : [];
        return {
          reply: mockReply({ scenarioId: sc.id, turn: input.userMessage ? turn : 0, level: ctx.level, userText: input.userMessage ?? "", name: ctx.name }),
          corrections: corrections.map(({ ruleIds: _r, ...c }) => c),
          newWords: [],
        };
      },
    );
  },

  /** Detects important mistakes in a text (also used by "Create a sentence" exercises). */
  async detectMistake(ctx: Pick<TeacherContext, "englishOnly">, text: string): Promise<AIResult<S.Correction[]>> {
    return withFallback(
      async () => {
        const out = await jsonCall(
          z.object({ corrections: z.array(S.correctionSchema).max(5).catch([]) }),
          P.correctSystem(ctx.englishOnly),
          [{ role: "user", content: text.slice(0, 1200) }],
          { maxTokens: 500, temperature: 0.2 },
        );
        return out.corrections;
      },
      () => mockCorrect(text, ctx.englishOnly).map(({ ruleIds: _r, ...c }) => c),
    );
  },

  async correctSentence(ctx: Pick<TeacherContext, "englishOnly">, text: string) {
    const r = await this.detectMistake(ctx, text);
    return { ...r, data: { corrected: r.data.length ? r.data.map((c) => c.corrected).join(" ") : text, corrections: r.data } };
  },

  /** Flashcard draft for a word: translation, definition, example, level, synonyms, collocations… */
  async generateFlashcard(word: string): Promise<AIResult<S.FlashcardDraft>> {
    return withFallback(
      () => jsonCall(S.flashcardDraftSchema, P.flashcardSystem(), [{ role: "user", content: `Word: ${word.slice(0, 80)}` }], { maxTokens: 600, temperature: 0.3 }),
      async () => {
        // Demo mode can only reuse what is already in the lexicon — it does not invent content.
        const hit = await db.vocabulary.findFirst({ where: { normalized: normalizeWord(word), ownerId: null } });
        return {
          word: hit?.word ?? word,
          translation: hit?.translation ?? "",
          definition: hit?.definition ?? "",
          example: hit?.example ?? "",
          exampleTranslation: hit?.exampleTranslation ?? "",
          pos: hit?.pos ?? "NOUN",
          level: hit?.level ?? "B1",
          ipa: hit?.ipa ?? "",
          synonyms: hit?.synonyms ?? [],
          antonyms: hit?.antonyms ?? [],
          collocations: hit?.collocations ?? [],
          pastSimple: hit?.pastSimple ?? null,
          pastParticiple: hit?.pastParticiple ?? null,
        };
      },
    );
  },

  async generateExample(word: string, level: string) {
    return withFallback(
      () => jsonCall(z.object({ example: z.string(), exampleTranslation: z.string() }), P.exampleSystem(), [{ role: "user", content: `Word: ${word.slice(0, 60)}\nLevel: ${level}` }], { maxTokens: 200, temperature: 0.6 }),
      async () => {
        const hit = await db.vocabulary.findFirst({ where: { normalized: normalizeWord(word), ownerId: null } });
        return { example: hit?.example ?? "", exampleTranslation: hit?.exampleTranslation ?? "" };
      },
    );
  },

  /** Wrap-up of a conversation: qualitative report + level estimate. Numeric stats are computed by the caller. */
  async analyzeConversation(
    ctx: TeacherContext,
    transcript: { role: "USER" | "ASSISTANT"; content: string; corrected?: boolean; lowConfidence?: boolean }[],
  ): Promise<AIResult<S.ConversationReport>> {
    const userMsgs = transcript.filter((t) => t.role === "USER");
    const corrections = userMsgs.filter((t) => t.corrected).length;
    return withFallback(
      () =>
        jsonCall(S.reportSchema, P.reportSystem(ctx), [
          { role: "user", content: transcript.map((t) => `${t.role === "USER" ? "LEARNER" : "TEACHER"}: ${t.content.slice(0, 500)}`).join("\n").slice(0, 8000) },
        ], { maxTokens: 800, temperature: 0.3 }),
      () => {
        const h = heuristicLevel(userMsgs.map((m) => m.content), corrections);
        const low = userMsgs.filter((m) => m.lowConfidence).length;
        return {
          summary: ctx.englishOnly ? "Report generated in demo mode from simple statistics." : "Rapport généré en mode démo à partir de statistiques simples (pas d'analyse IA).",
          vocabulary: [],
          grammar: corrections ? [ctx.englishOnly ? `${corrections} message(s) contained mistakes — see your corrections.` : `${corrections} message(s) contenaient des erreurs : consultez vos corrections.`] : [],
          pronunciation: low ? [ctx.englishOnly ? `${low} spoken message(s) were recognised with low confidence.` : `${low} message(s) oraux ont été reconnus avec une faible confiance : prononciation à travailler.`] : [],
          fluency: [userMsgs.length < 5 ? (ctx.englishOnly ? "Try to speak a little longer next time." : "Essayez de parler un peu plus longtemps la prochaine fois.") : ctx.englishOnly ? "Good conversation length." : "Bonne longueur de conversation."],
          newVocabulary: [],
          estimatedLevel: h.level as S.ConversationReport["estimatedLevel"],
          levelPlus: h.plus,
          tips: [],
        };
      },
    );
  },

  /** Level estimate from free text samples. */
  async estimateLevel(samples: string[]) {
    return withFallback(
      () => jsonCall(S.levelEstimateSchema, P.levelSystem(), [{ role: "user", content: samples.join("\n---\n").slice(0, 6000) }], { maxTokens: 200, temperature: 0.1 }),
      () => {
        const h = heuristicLevel(samples);
        return { level: h.level as S.ConversationReport["estimatedLevel"], plus: h.plus, rationale: "Estimation heuristique (mode démo)." };
      },
    );
  },

  /** Targeted exercises for a skill. Demo mode serves the hand-written lesson exercises. */
  async generateExercises(topic: string, level: string, count = 6) {
    return withFallback(
      async () => {
        const out = await jsonCall(S.exerciseSchema, P.exercisesSystem(), [{ role: "user", content: `Topic: ${topic.slice(0, 80)}\nCEFR level: ${level}\nCount: ${count}` }], { maxTokens: 1500, temperature: 0.5 });
        return out.exercises.map((e, i) => ({ id: `ai${i}`, ...e }));
      },
      () => {
        const lesson = lessonBySlug(topic) ?? GRAMMAR_LESSONS.find((l) => l.skillSlug === topic) ?? GRAMMAR_LESSONS[0];
        return lesson.exercises.filter((e) => e.type !== "listen" && e.type !== "create").slice(0, count);
      },
    );
  },

  async generateVocabulary(topic: string, level: string, known: string[], count = 10) {
    return withFallback(
      async () => {
        const out = await jsonCall(S.vocabListSchema, P.vocabSystem(), [{ role: "user", content: `Topic: ${topic.slice(0, 80)}\nLevel: ${level}\nCount: ${count}\nAlready known: ${known.slice(0, 60).join(", ")}` }], { maxTokens: 1500, temperature: 0.7 });
        return out.words;
      },
      async () => {
        const rows = await db.vocabulary.findMany({
          where: { ownerId: null, level: level as never, tags: { hasSome: [`deck:${topic.toLowerCase()}`] }, normalized: { notIn: known.map(normalizeWord) } },
          take: count,
        });
        return rows.map((r) => ({ word: r.word, translation: r.translation, pos: r.pos, level: r.level, example: r.example ?? "", exampleTranslation: r.exampleTranslation ?? "" }));
      },
    );
  },

  /** Grammar explanation for a question/topic. Demo mode returns the matching lesson summary. */
  async explainGrammar(ctx: Pick<TeacherContext, "englishOnly">, topic: string) {
    return withFallback(
      async () => (await complete({ system: P.grammarSystem(ctx.englishOnly), messages: [{ role: "user", content: topic.slice(0, 300) }], maxTokens: 600, temperature: 0.4 })).trim(),
      () => {
        const q = topic.toLowerCase();
        const l = GRAMMAR_LESSONS.find((x) => q.includes(x.slug.replace("-", " ")) || q.includes(x.title.toLowerCase())) ?? null;
        return l ? `${l.summary}\n\nStructure : ${l.structure.affirmative}.` : "Mode démo : posez votre question avec une clé IA configurée, ou ouvrez une leçon de la section Grammar.";
      },
    );
  },

  /** Explains or translates a word the learner clicked in a conversation. */
  async explainWord(word: string, sentence: string, mode: "english" | "french") {
    return withFallback(
      async () =>
        (await complete({ system: P.wordSystem(mode), messages: [{ role: "user", content: `Word: ${word.slice(0, 60)}\nSentence: ${sentence.slice(0, 400)}` }], maxTokens: 250, temperature: 0.3 })).trim(),
      async () => {
        const hit = await db.vocabulary.findFirst({ where: { normalized: normalizeWord(word), ownerId: null } });
        if (!hit) return mode === "french" ? "Mot absent du lexique local (mode démo, pas d'IA)." : "This word isn't in the local lexicon (demo mode, no AI).";
        return mode === "french" ? `${hit.word} : ${hit.translation}${hit.example ? `\n« ${hit.exampleTranslation} »` : ""}` : `${hit.word} (${hit.category.toLowerCase()})${hit.definition ? ` — ${hit.definition}` : ""}${hit.example ? `\nExample: ${hit.example}` : ""}`;
      },
    );
  },

  /** One-line motivational coaching sentence for the daily plan. */
  async generateLearningPlan(summary: string) {
    return withFallback(
      async () => (await complete({ system: P.coachSystem(), messages: [{ role: "user", content: summary.slice(0, 800) }], maxTokens: 100, temperature: 0.7 })).trim(),
      () => "",
    );
  },
};

export { countWords };
