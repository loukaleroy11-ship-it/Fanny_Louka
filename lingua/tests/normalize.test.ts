import { describe, expect, it } from "vitest";
import { answerMatches, lemmaCandidates, normalizeAnswer, normalizeWord, countWords } from "@/lib/normalize";

describe("normalizeWord (duplicate detection key)", () => {
  it("is case-, space- and punctuation-insensitive", () => {
    expect(normalizeWord("  House ")).toBe("house");
    expect(normalizeWord("HOUSE!")).toBe("house");
    expect(normalizeWord("look   after")).toBe("look after");
    expect(normalizeWord("Look-after")).toBe("look-after");
    expect(normalizeWord("don’t")).toBe("don't");
  });
  it("does not conflate different words", () => {
    expect(normalizeWord("run")).not.toBe(normalizeWord("running"));
    expect(normalizeWord("go")).not.toBe(normalizeWord("went"));
  });
});

describe("lemmaCandidates (suggestions only)", () => {
  it("suggests base forms", () => {
    expect(lemmaCandidates("running")).toContain("run");
    expect(lemmaCandidates("houses")).toContain("house");
    expect(lemmaCandidates("studies")).toContain("study");
    expect(lemmaCandidates("stopped")).toContain("stop");
    expect(lemmaCandidates("making")).toContain("make");
  });
  it("returns nothing for phrases", () => {
    expect(lemmaCandidates("look after")).toEqual([]);
  });
});

describe("answer checking", () => {
  it("ignores case, punctuation and contractions", () => {
    expect(answerMatches("i'm cooking", ["I am cooking."])).toBe(true);
    expect(answerMatches("She doesn't like coffee", ["She does not like coffee."])).toBe(true);
    expect(answerMatches("it's raining", ["It is raining"])).toBe(true);
    expect(answerMatches("went", ["goes"])).toBe(false);
  });
  it("normalizeAnswer is idempotent", () => {
    const x = normalizeAnswer("You're  RIGHT!");
    expect(normalizeAnswer(x)).toBe(x);
  });
  it("counts words", () => {
    expect(countWords("I went to the beach, didn't I?")).toBe(7);
  });
});
