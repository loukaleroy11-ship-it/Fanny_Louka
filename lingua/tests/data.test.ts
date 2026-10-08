import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRAMMAR_LESSONS, GRAMMAR_SKILLS } from "@/content/grammar";
import { PLACEMENT_QUESTIONS } from "@/content/placement";
import { SCENARIOS } from "@/content/scenarios";
import { answerMatches } from "@/lib/normalize";

const read = (f: string) => readFileSync(join(process.cwd(), "data", f), "utf8");
const base = JSON.parse(read("common500.base.json")) as { rank: number; word: string; count: number }[];
const enrich = read("common500.enrich.txt").split("\n").filter(Boolean).map((l) => l.split("|"));
const POS = ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "auxiliary", "modal", "interjection"];

describe("500 most common words", () => {
  it("contains exactly 500 unique words ranked 1..500 in source order", () => {
    expect(base).toHaveLength(500);
    expect(base.map((b) => b.rank)).toEqual(Array.from({ length: 500 }, (_, i) => i + 1));
    expect(new Set(base.map((b) => b.word)).size).toBe(500);
    for (let i = 1; i < base.length; i++) expect(base[i].count).toBeLessThanOrEqual(base[i - 1].count);
  });
  it("enrichment aligns with the base list and has every required field", () => {
    expect(enrich).toHaveLength(500);
    enrich.forEach((e, i) => {
      const [word, pos, level, ipa, fr, ex, exFr] = e;
      expect(word, `row ${i + 1}`).toBe(base[i].word);
      expect(POS, word).toContain(pos);
      expect(["A1", "A2", "B1", "B2"], word).toContain(level);
      for (const [n, v] of Object.entries({ ipa, fr, ex, exFr })) expect(v?.trim(), `${word}.${n}`).toBeTruthy();
    });
  });
  it("example sentences contain the word or its lemma form", () => {
    const miss: string[] = [];
    for (const e of enrich) {
      const w = e[0];
      const lemma = e[7];
      const ex = e[5].toLowerCase();
      const stems = [w, lemma].filter(Boolean) as string[];
      if (!stems.some((s) => ex.includes(s.toLowerCase().slice(0, Math.max(2, s.length - 2))))) miss.push(`${w}: ${e[5]}`);
    }
    // a handful of suppletive forms (e.g. "was" ← be, "mine" ← my) legitimately differ
    expect(miss.length, miss.join("\n")).toBeLessThan(15);
  });
  it("documents its source", () => {
    expect(readFileSync(join(process.cwd(), "data", "SOURCES.md"), "utf8")).toMatch(/OpenSubtitles/);
  });
});

describe("verbs", () => {
  const verbs = JSON.parse(read("verbs.json")) as { base: string; past: string; participle: string; fr: string; rank: number; count: number }[];
  it("has 100+ verbs with forms and consecutive ranks by frequency", () => {
    expect(verbs.length).toBeGreaterThanOrEqual(100);
    expect(verbs.map((v) => v.rank)).toEqual(verbs.map((_, i) => i + 1));
    for (let i = 1; i < verbs.length; i++) expect(verbs[i].count).toBeLessThanOrEqual(verbs[i - 1].count);
    for (const v of verbs) { expect(v.past && v.participle && v.fr, v.base).toBeTruthy(); }
  });
  it("go → went / gone", () => {
    const go = verbs.find((v) => v.base === "go")!;
    expect([go.past, go.participle, go.fr]).toEqual(["went", "gone", "aller"]);
  });
});

describe("grammar content", () => {
  it("covers the five core tenses", () => {
    expect(GRAMMAR_LESSONS.map((l) => l.slug)).toEqual(["present-simple", "present-continuous", "past-simple", "present-perfect", "future-forms"]);
  });
  it("every lesson explains when/structure/auxiliary/examples/negation/question/errors", () => {
    for (const l of GRAMMAR_LESSONS) {
      expect(l.whenToUse.length, l.slug).toBeGreaterThanOrEqual(3);
      expect(l.structure.negative && l.structure.question && l.structure.affirmative, l.slug).toBeTruthy();
      expect(l.auxiliary, l.slug).toBeTruthy();
      expect(l.examples.length, l.slug).toBeGreaterThanOrEqual(4);
      expect(l.commonErrors.length, l.slug).toBeGreaterThanOrEqual(3);
      expect(GRAMMAR_SKILLS.some((s) => s.slug === l.skillSlug)).toBe(true);
    }
  });
  it("exercises are well-formed and cover all five types", () => {
    const types = new Set<string>();
    for (const l of GRAMMAR_LESSONS) {
      const ids = new Set<string>();
      for (const e of l.exercises) {
        types.add(e.type);
        expect(ids.has(e.id), `${l.slug} duplicate id ${e.id}`).toBe(false);
        ids.add(e.id);
        if (e.type === "choose") expect(e.options).toContain(e.answer);
        if (e.type === "complete" || e.type === "translate" || e.type === "correct") {
          expect(e.answers.length).toBeGreaterThan(0);
          expect(answerMatches(e.answers[0], e.answers)).toBe(true);
        }
        if (e.type === "create") expect(new RegExp(e.pattern, "i").test(e.example), `${l.slug}/${e.id} example must satisfy its own pattern`).toBe(true);
      }
    }
    expect([...types].sort()).toEqual(["choose", "complete", "correct", "create", "listen", "translate"]);
  });
});

describe("placement test", () => {
  it("covers vocabulary, grammar, conjugation, reading across A1–C1, answers are valid options", () => {
    const sections = new Set(PLACEMENT_QUESTIONS.map((q) => q.section));
    expect([...sections].sort()).toEqual(["conjugation", "grammar", "reading", "vocabulary"]);
    for (const q of PLACEMENT_QUESTIONS) expect(q.options, q.id).toContain(q.answer);
    expect(new Set(PLACEMENT_QUESTIONS.map((q) => q.level)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(PLACEMENT_QUESTIONS.map((q) => q.id)).size).toBe(PLACEMENT_QUESTIONS.length);
  });
});

describe("scenarios", () => {
  it("has the 16 required scenarios", () => {
    const need = ["casual", "travel", "airport", "hotel", "restaurant", "shopping", "job-interview", "work", "university", "meeting-people", "dating", "australia", "sports", "movies", "technology", "daily-life"];
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(need.sort());
    for (const s of SCENARIOS) expect(s.questions.length).toBeGreaterThanOrEqual(4);
  });
});
