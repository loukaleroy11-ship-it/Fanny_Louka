/**
 * The live-LLM code path, exercised against a *stubbed* Anthropic Messages API (no network, no key).
 * This verifies request shape, message normalisation and JSON validation — it does NOT prove the
 * behaviour of the real model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { complete, isMockMode } from "@/lib/ai/llm";
import { AIService, normalizeForLLM } from "@/lib/ai/service";
import type { TeacherContext } from "@/lib/ai/context";

const ctx: TeacherContext = {
  name: "Anna", level: "B1", levelLabel: "B1", goal: "Travel", englishOnly: false, accent: "US",
  skills: [{ area: "Grammar", level: "A2+" }], weakGrammar: [{ name: "Past simple", mistakes: 5 }],
  recentMistakes: [{ original: "I go yesterday", corrected: "I went yesterday" }], knownWords: ["house"], studyingWords: ["although"],
  hardWords: ["although"], recentScenarios: [],
};

let calls: { url: string; init: RequestInit & { body: string } }[] = [];
const reply = (text: string, status = 200) => vi.fn(async (url: string, init: RequestInit & { body: string }) => {
  calls.push({ url, init });
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status });
});

beforeEach(() => { calls = []; vi.stubEnv("ANTHROPIC_API_KEY", "test-key"); vi.stubEnv("AI_FORCE_MOCK", "false"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("mock-mode switch", () => {
  it("is on without a key or when forced", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isMockMode()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "k"); vi.stubEnv("AI_FORCE_MOCK", "true");
    expect(isMockMode()).toBe(true);
    vi.stubEnv("AI_FORCE_MOCK", "false");
    expect(isMockMode()).toBe(false);
  });
});

describe("Anthropic request", () => {
  it("POSTs /v1/messages with key header, version, model and system prompt (key never in body)", async () => {
    vi.stubGlobal("fetch", reply("hello"));
    const out = await complete({ system: "SYS", messages: [{ role: "user", content: "hi" }], maxTokens: 50 });
    expect(out).toBe("hello");
    const { url, init } = calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const h = init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe("test-key");
    expect(h["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 50, system: "SYS", messages: [{ role: "user", content: "hi" }] });
    expect(init.body).not.toContain("test-key");
  });
  it("retries once on 429/5xx then succeeds", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++n === 1 ? new Response("busy", { status: 429 }) : new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }] }), { status: 200 }))));
    expect(await complete({ system: "s", messages: [{ role: "user", content: "x" }] })).toBe("ok");
    expect(n).toBe(2);
  });
  it("honours ANTHROPIC_BASE_URL / ANTHROPIC_MODEL", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://gw.example.com/"); vi.stubEnv("ANTHROPIC_MODEL", "my-model");
    vi.stubGlobal("fetch", reply("x"));
    await complete({ system: "s", messages: [{ role: "user", content: "x" }] });
    expect(calls[0].url).toBe("https://gw.example.com/v1/messages");
    expect(JSON.parse(calls[0].init.body).model).toBe("my-model");
  });
});

describe("message normalisation", () => {
  it("starts with a user turn and alternates roles", () => {
    const n = normalizeForLLM([{ role: "assistant", content: "Hi!" }, { role: "user", content: "a" }, { role: "user", content: "b" }, { role: "assistant", content: "ok" }]);
    expect(n.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(n[2].content).toBe("a\nb");
  });
  it("truncates long messages and keeps the last 20", () => {
    const h = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: "x".repeat(2000) }));
    const n = normalizeForLLM(h);
    expect(n.length).toBeLessThanOrEqual(21);
    expect(n.every((m) => m.content.length <= 1000 + 40)).toBe(true);
  });
});

describe("AIService (live path, stubbed API)", () => {
  it("conversation turn: parses JSON, returns mock=false, personalises the system prompt", async () => {
    const json = JSON.stringify({ reply: "Nice! What did you do there?", corrections: [{ original: "I go to the beach yesterday.", corrected: "I went to the beach yesterday.", explanation: "Past simple.", category: "GRAMMAR", skill: "past-simple" }], newWords: [] });
    vi.stubGlobal("fetch", reply("```json\n" + json + "\n```"));
    const r = await AIService.generateConversationResponse(ctx, { scenarioId: "casual", history: [{ role: "assistant", content: "How was your day?" }], userMessage: "It was good, I go to the beach yesterday." });
    expect(r.mock).toBe(false);
    expect(r.data.corrections[0].skill).toBe("past-simple");
    const body = JSON.parse(calls[0].init.body);
    expect(body.system).toContain("USER SPEAKS MORE THAN YOU");
    expect(body.system).toContain("Past simple (5 mistakes)");
    expect(body.system).toContain("I go yesterday");
    expect(body.system).toContain("although");
    expect(body.messages[0].role).toBe("user");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "It was good, I go to the beach yesterday." });
    // the learner's text is never concatenated into the system prompt
    expect(body.system).not.toContain("beach");
  });
  it("English Only: instructs the model to use English everywhere", async () => {
    vi.stubGlobal("fetch", reply(JSON.stringify({ reply: "Hello!", corrections: [], newWords: [] })));
    await AIService.generateConversationResponse({ ...ctx, englishOnly: true }, { scenarioId: "casual", history: [], userMessage: null });
    expect(JSON.parse(calls[0].init.body).system).toContain("ENGLISH ONLY MODE");
  });
  it("level adaptation instructions differ per level", async () => {
    vi.stubGlobal("fetch", reply(JSON.stringify({ reply: "Hi", corrections: [], newWords: [] })));
    await AIService.generateConversationResponse({ ...ctx, level: "A1" }, { scenarioId: "casual", history: [], userMessage: null });
    await AIService.generateConversationResponse({ ...ctx, level: "C1" }, { scenarioId: "casual", history: [], userMessage: null });
    expect(JSON.parse(calls[0].init.body).system).toContain("at most 8 words");
    expect(JSON.parse(calls[1].init.body).system).toContain("sophisticated vocabulary");
  });
  it("invalid JSON twice → falls back to demo mode with a warning (never crashes)", async () => {
    vi.stubGlobal("fetch", reply("I'm sorry, I can't produce JSON."));
    const r = await AIService.generateConversationResponse(ctx, { scenarioId: "casual", history: [], userMessage: "I go to the beach yesterday." });
    expect(r.mock).toBe(true);
    expect(r.warning).toMatch(/indisponible/);
    expect(r.data.corrections[0].corrected).toContain("went");
  });
  it("API error → demo fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    const r = await AIService.generateConversationResponse(ctx, { scenarioId: "casual", history: [], userMessage: "hello there" });
    expect(r.mock).toBe(true);
  });
  it("flashcard draft is validated and normalised", async () => {
    vi.stubGlobal("fetch", reply(JSON.stringify({ word: "although", translation: "bien que", definition: "in spite of the fact that", example: "Although it was raining, we went outside.", exampleTranslation: "Bien qu'il pleuve, nous sommes sortis.", pos: "CONJUNCTION", level: "B1", ipa: "ɔːlˈðəʊ", synonyms: ["though"], antonyms: [], collocations: [], pastSimple: null, pastParticiple: null })));
    const r = await AIService.generateFlashcard("although");
    expect(r.mock).toBe(false);
    expect(r.data).toMatchObject({ translation: "bien que", pos: "CONJUNCTION", level: "B1" });
  });
});
