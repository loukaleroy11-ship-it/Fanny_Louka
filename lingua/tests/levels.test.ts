import { describe, expect, it } from "vitest";
import { estimateAbility, levelLabel, levelOf, overallValue, pCorrect, updateSkillValue, valueOfLevel } from "@/lib/levels";
import { LEVEL_DIFFICULTY } from "@/content/placement";

describe("CEFR scale", () => {
  it("maps values to levels and + sublevels", () => {
    expect(levelOf(0.1)).toBe("A1");
    expect(levelOf(1.9)).toBe("A2");
    expect(levelLabel(1.6)).toBe("A2+");
    expect(levelLabel(2.1)).toBe("B1");
    expect(levelOf(99)).toBe("C2");
    expect(levelOf(-3)).toBe("A1");
  });
  it("a declared level reads as itself (no +)", () => {
    expect(levelLabel(valueOfLevel("A1"))).toBe("A1");
    expect(levelLabel(valueOfLevel("B2"))).toBe("B2");
  });
  it("overall ignores skills without evidence when some have evidence", () => {
    const v = overallValue([
      { area: "VOCABULARY", value: 3, evidence: 10 },
      { area: "GRAMMAR", value: 3, evidence: 5 },
      { area: "SPEAKING", value: 0.2, evidence: 0 },
    ]);
    expect(v).toBeCloseTo(3, 5);
  });
});

describe("ability estimation", () => {
  const D = LEVEL_DIFFICULTY;
  const ans = (pattern: Record<string, boolean[]>) => Object.entries(pattern).flatMap(([lvl, rs]) => rs.map((correct) => ({ difficulty: D[lvl as keyof typeof D], correct })));
  it("all wrong → A1, all right → high", () => {
    const low = estimateAbility(ans({ A1: [false, false], A2: [false, false], B1: [false, false], B2: [false], C1: [false] }));
    const high = estimateAbility(ans({ A1: [true, true], A2: [true, true], B1: [true, true], B2: [true], C1: [true] }));
    expect(levelOf(low)).toBe("A1");
    expect(high).toBeGreaterThan(4.5);
  });
  it("passing up to B1 and failing above lands in the B1 zone", () => {
    const mid = estimateAbility(ans({ A1: [true, true], A2: [true, true], B1: [true, true], B2: [false], C1: [false] }));
    expect(["B1", "B2"]).toContain(levelOf(mid));
  });
  it("is monotonic in the number of correct answers", () => {
    const qs = [0.5, 0.5, 1.5, 1.5, 2.5, 2.5, 3.5, 4.5];
    const score = (k: number) => estimateAbility(qs.map((d, i) => ({ difficulty: d, correct: i < k })));
    for (let k = 0; k < qs.length; k++) expect(score(k + 1)).toBeGreaterThanOrEqual(score(k));
  });
  it("pCorrect rises with ability", () => {
    expect(pCorrect(4, 2)).toBeGreaterThan(pCorrect(1, 2));
  });
});

describe("incremental skill update (level evolves automatically)", () => {
  it("moves up on hard successes, down on easy failures, and slows with evidence", () => {
    const up = updateSkillValue(1.5, 0, 3.5, true);
    const down = updateSkillValue(3.5, 0, 0.5, false);
    expect(up).toBeGreaterThan(1.5);
    expect(down).toBeLessThan(3.5);
    const early = updateSkillValue(1.5, 0, 3.5, true) - 1.5;
    const late = updateSkillValue(1.5, 200, 3.5, true) - 1.5;
    expect(late).toBeLessThan(early);
    // bounded
    let v = 5.9;
    for (let i = 0; i < 100; i++) v = updateSkillValue(v, 0, 5.5, true);
    expect(v).toBeLessThan(6);
  });
});
