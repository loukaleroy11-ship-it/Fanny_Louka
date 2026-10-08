import { describe, expect, it } from "vitest";
import { buildCardOrder, buildCardWhere, cardFilterSchema, difficultyBucket, FUNCTION_FILTERS } from "@/lib/filters";

const END = new Date("2026-01-01T23:59:59Z");
const parse = (o: object) => cardFilterSchema.parse(o);
const flat = (w: unknown) => JSON.stringify(w);

describe("review filters", () => {
  it("empty filter only scopes to the user", () => {
    const w = buildCardWhere("u1", parse({}), END);
    expect(flat(w)).toContain('"userId":"u1"');
  });

  it("rank range 120–250 → frequency rank gte/lte", () => {
    const w = flat(buildCardWhere("u1", parse({ rankMin: 120, rankMax: 250 }), END));
    expect(w).toContain('"rank":{"gte":120,"lte":250}');
  });

  it("combines 20 cards + verbs + rank 1–200 + difficult (AND across groups)", () => {
    const f = parse({ functions: ["verb"], rankMin: 1, rankMax: 200, difficulty: ["hard"] });
    const w = flat(buildCardWhere("u1", f, END));
    expect(w).toContain('"pos":{"in":["VERB"]}');
    expect(w).toContain('"rank":{"gte":1,"lte":200}');
    expect(w).toContain('"lapses":{"gte":2}');
    expect(w).toContain('"difficulty":{"gte":7}');
  });

  it("OR inside a group: verbs + adjectives", () => {
    const w = flat(buildCardWhere("u1", parse({ functions: ["verb", "adjective"] }), END));
    expect(w).toContain('"pos":{"in":["VERB","ADJECTIVE"]}');
  });

  it("scopes: mine / mistakes / common500", () => {
    const w = flat(buildCardWhere("u1", parse({ scope: ["mine", "mistakes", "common500"] }), END));
    expect(w).toContain('"origin":{"in":["USER","AI","IMPORT"]}');
    expect(w).toContain('"origin":"MISTAKE"');
    expect(w).toContain('"kind":"COMMON500"');
  });

  it("status: due = studied & due before end of day; new = state 0", () => {
    const w = flat(buildCardWhere("u1", parse({ status: ["due", "new"] }), END));
    expect(w).toContain('"state":{"not":0}');
    expect(w).toContain('"lte":"2026-01-01T23:59:59.000Z"');
    expect(w).toContain('"state":0');
  });

  it("rejects nonsense", () => {
    expect(() => parse({ functions: ["banana"] })).toThrow();
    expect(() => parse({ rankMin: 0 })).toThrow();
  });

  it("all grammatical functions of the spec exist", () => {
    for (const k of ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "determiner", "auxiliary", "modal", "phrasal", "expression"])
      expect(Object.keys(FUNCTION_FILTERS)).toContain(k);
  });

  it("sorting options", () => {
    expect(flat(buildCardOrder("rank"))).toContain("rank");
    expect(flat(buildCardOrder("function"))).toContain('"pos":"asc"');
    expect(flat(buildCardOrder("level"))).toContain('"level":"asc"');
    expect(flat(buildCardOrder("newest"))).toContain('"createdAt":"desc"');
    expect(flat(buildCardOrder("oldest"))).toContain('"createdAt":"asc"');
    expect(flat(buildCardOrder("difficulty"))).toContain('"lapses":"desc"');
  });

  it("personal difficulty buckets", () => {
    expect(difficultyBucket({ reps: 0, lapses: 0, difficulty: 0 })).toBe("new");
    expect(difficultyBucket({ reps: 3, lapses: 0, difficulty: 3 })).toBe("easy");
    expect(difficultyBucket({ reps: 3, lapses: 0, difficulty: 5 })).toBe("medium");
    expect(difficultyBucket({ reps: 3, lapses: 2, difficulty: 3 })).toBe("hard");
    expect(difficultyBucket({ reps: 3, lapses: 0, difficulty: 8 })).toBe("hard");
  });
});
