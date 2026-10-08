import { describe, expect, it } from "vitest";
import { heuristicLevel, mockCorrect, mockFactCheck, mockReply, topicOf } from "@/lib/ai/mock";
import { extractJson } from "@/lib/ai/llm";
import { turnSchema, flashcardDraftSchema } from "@/lib/ai/schemas";

const fix = (s: string) => mockCorrect(s)[0]?.corrected;

describe("mock corrector (demo mode)", () => {
  it("the spec example: 'I go to the beach yesterday.'", () => {
    const c = mockCorrect("I go to the beach yesterday.");
    expect(c).toHaveLength(1);
    expect(c[0].corrected).toBe("I went to the beach yesterday.");
    expect(c[0].skill).toBe("past-simple");
    expect(c[0].category).toBe("GRAMMAR");
  });
  it("past simple with other verbs / markers", () => {
    expect(fix("We eat pizza last night.")).toBe("We ate pizza last night.");
    expect(fix("She buy a car two years ago.")).toBe("She bought a car two years ago.");
    expect(fix("I walk to school yesterday.")).toBe("I walked to school yesterday.");
  });
  it("be → was/were with a past marker", () => {
    expect(fix("I am at home yesterday.")).toBe("I was at home yesterday.");
    expect(fix("They are in Paris last week.")).toBe("They were in Paris last week.");
  });
  it("did + past form → base form", () => {
    expect(fix("Did you went there?")).toBe("Did you go there?");
    expect(fix("She didn't saw him.")).toBe("She didn't see him.");
  });
  it("third-person -s and do/does agreement", () => {
    expect(fix("She work in a bank.")).toBe("She works in a bank.");
    expect(fix("He don't like fish.")).toBe("He doesn't like fish.");
    expect(fix("It doesn't works.")).toBe("It doesn't work.");
  });
  it("present perfect issues", () => {
    expect(fix("I have seen him yesterday.")).toBe("I saw him yesterday.");
    expect(fix("I live here since 2020.")).toBe("I have lived here since 2020.");
    expect(fix("I have worked here since three years.")).toBe("I have worked here for three years.");
  });
  it("prepositions and classic French-speaker errors", () => {
    expect(fix("It depends of you.")).toBe("It depends on you.");
    expect(fix("I am agree.")).toBe("I agree.");
    expect(fix("I listen music every day.")).toBe("I listen to music every day.");
    expect(fix("I listen the radio.")).toBe("I listen to the radio.");
    expect(fix("I'm interested by history.")).toBe("I'm interested in history.");
    expect(fix("I have 20 years.")).toBe("I am 20 years old.");
    expect(fix("This is more better.")).toBe("This is better.");
    expect(fix("I can to swim.")).toBe("I can swim.");
    expect(fix("I am teacher.")).toBe("I am a teacher.");
    expect(fix("There are many informations.")).toBe("There are many information.");
    expect(fix("People is nice.")).toBe("People are nice.");
    expect(fix("I did a mistake.")).toBe("I made a mistake.");
    expect(fix("Can you explain me this?")).toBe("Can you explain to me this?");
    expect(fix("I make a photo.")).toBe("I take a photo.");
  });
  it("English-only mode explains in English", () => {
    const fr = mockCorrect("She work here.", false)[0].explanation;
    const en = mockCorrect("She work here.", true)[0].explanation;
    expect(fr).toMatch(/3ᵉ personne/);
    expect(en).toMatch(/With he \/ she \/ it/);
  });
  it("leaves correct sentences alone (no false positives)", () => {
    for (const s of [
      "I went to the beach yesterday.", "She works in a bank.", "Did you go there?", "He doesn't like fish.",
      "I have lived here for three years.", "Yesterday I met my friends in the park.", "We can go tomorrow.",
      "They want to see the film.", "I think it will rain.", "She is a teacher.", "I agree with you.",
      "How was your day?", "It was good, and I read a book.",
    ]) expect(mockCorrect(s), s).toEqual([]);
  });
  it("splits multi-sentence messages and caps corrections", () => {
    const c = mockCorrect("I go to the beach yesterday. She work here. I am agree.");
    expect(c.length).toBe(3);
  });
});

describe("mock conversation", () => {
  it("opens with the scenario opener and asks questions afterwards", () => {
    expect(mockReply({ scenarioId: "airport", turn: 0, level: "A2", userText: "", name: "Anna" })).toMatch(/check-in/);
    const r = mockReply({ scenarioId: "airport", turn: 2, level: "A2", userText: "I am going to Rome for work.", name: "Anna" });
    expect(r).toContain("?");
  });
  it("asks for more when the answer is too short", () => {
    expect(mockReply({ scenarioId: "casual", turn: 1, level: "B1", userText: "ok", name: "A" })).toMatch(/full sentence/);
  });
  it("heuristic level grows with sentence length and vocabulary", () => {
    const low = heuristicLevel(["I like dog.", "I have car."]);
    const high = heuristicLevel(["Although the economy is struggling, I believe that governments should invest substantially in renewable infrastructure."], 0);
    expect(high.value).toBeGreaterThan(low.value);
  });
});

describe("LLM output parsing", () => {
  it("extracts JSON from fenced / chatty replies", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"a":[1,2]} thanks')).toEqual({ a: [1, 2] });
    expect(() => extractJson("no json")).toThrow();
  });
  it("validates teacher turns and repairs bad categories", () => {
    const t = turnSchema.parse({ reply: "Nice!", corrections: [{ original: "a", corrected: "b", explanation: "x", category: "WEIRD", skill: "nope" }] });
    expect(t.corrections[0].category).toBe("GRAMMAR");
    expect(t.corrections[0].skill).toBeNull();
    expect(() => turnSchema.parse({ reply: "" })).toThrow();
  });
  it("validates flashcard drafts with defaults", () => {
    const d = flashcardDraftSchema.parse({ word: "x", translation: "y", pos: "WRONG" });
    expect(d.pos).toBe("NOUN");
    expect(d.synonyms).toEqual([]);
  });
});

describe("mock conversation keeps a thread and reality-checks", () => {
  it("reacts to a word the learner used", () => {
    const r = mockReply({ scenarioId: "casual", turn: 2, level: "B1", userText: "Yesterday I visited my grandmother in the hospital.", name: "A" });
    expect(r.toLowerCase()).toMatch(/grandmother|hospital|visited/);
  });
  it("corrects false facts instead of playing along", () => {
    expect(mockReply({ scenarioId: "travel", turn: 1, level: "B1", userText: "Paris is the capital of Italy.", name: "A" })).toMatch(/capital of Italy is Rome/);
    expect(mockFactCheck("The sun rises in the west.")).toMatch(/east/);
    expect(mockFactCheck("2 + 2 = 5")).toMatch(/is 4/);
    expect(mockFactCheck("Rome is the capital of Italy.")).toBeNull();
  });
  it("topicOf ignores filler", () => {
    expect(topicOf("I went to the beach with my friends")).toBe("friends");
    expect(topicOf("yes ok")).toBeNull();
  });
});
