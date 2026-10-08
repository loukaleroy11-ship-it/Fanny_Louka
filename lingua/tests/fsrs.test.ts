import { describe, expect, it } from "vitest";
import { gradeCard, intervalLabel, newCardState, previewIntervals } from "@/lib/fsrs";

const T0 = new Date("2026-01-01T10:00:00Z");
const days = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86400000;

describe("FSRS scheduling", () => {
  it("orders the four ratings on a new card: Again < Hard < Good < Easy", () => {
    const c = newCardState(T0);
    const due = ([1, 2, 3, 4] as const).map((r) => gradeCard(c, r, T0).next.due.getTime());
    expect(due[0]).toBeLessThan(due[1]);
    expect(due[1]).toBeLessThanOrEqual(due[2]);
    expect(due[2]).toBeLessThan(due[3]);
  });

  it("Easy graduates a new card straight to Review with a multi-day interval", () => {
    const r = gradeCard(newCardState(T0), 4, T0).next;
    expect(r.state).toBe(2);
    expect(days(T0, r.due)).toBeGreaterThanOrEqual(3);
  });

  it("Again keeps the card in learning with a short delay (minutes)", () => {
    const r = gradeCard(newCardState(T0), 1, T0).next;
    expect(r.state).toBe(1);
    expect(r.due.getTime() - T0.getTime()).toBeLessThan(15 * 60_000);
  });

  it("mastered cards are spaced progressively (intervals grow)", () => {
    let c = gradeCard(newCardState(T0), 3, T0).next;
    let now = c.due;
    c = gradeCard(c, 3, now).next; // graduates
    const gaps: number[] = [];
    now = c.due;
    for (let i = 0; i < 6; i++) {
      const n = gradeCard(c, 3, now).next;
      gaps.push(days(now, n.due));
      c = n;
      now = n.due;
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1] * 0.95);
    expect(gaps[gaps.length - 1]).toBeGreaterThan(gaps[0] * 3);
  });

  it("a lapse brings the card back sooner and counts it", () => {
    let c = gradeCard(newCardState(T0), 3, T0).next;
    c = gradeCard(c, 3, c.due).next;
    const good = gradeCard(c, 3, c.due).next;
    const before = c.due;
    const lapsed = gradeCard(c, 1, before).next;
    expect(lapsed.lapses).toBe(c.lapses + 1);
    expect(lapsed.due.getTime()).toBeLessThan(good.due.getTime());
    expect(lapsed.state).toBe(3); // relearning
  });

  it("difficult cards (repeated Again) get higher difficulty than easy ones", () => {
    let hard = gradeCard(newCardState(T0), 1, T0).next;
    let easy = gradeCard(newCardState(T0), 4, T0).next;
    for (let i = 0; i < 4; i++) {
      hard = gradeCard(hard, 1, hard.due).next;
      easy = gradeCard(easy, 4, easy.due).next;
    }
    expect(hard.difficulty).toBeGreaterThan(easy.difficulty);
    expect(hard.lapses + 0).toBeGreaterThanOrEqual(0);
  });

  it("higher desired retention means shorter intervals", () => {
    const base = gradeCard(gradeCard(newCardState(T0), 3, T0).next, 3, T0).next;
    const hi = gradeCard(base, 3, base.due, 0.97).next;
    const lo = gradeCard(base, 3, base.due, 0.85).next;
    expect(hi.scheduledDays).toBeLessThanOrEqual(lo.scheduledDays);
  });

  it("previews labels for the 4 buttons", () => {
    const p = previewIntervals(newCardState(T0), T0);
    expect(Object.keys(p)).toEqual(["1", "2", "3", "4"]);
    expect(p[1]).toMatch(/min$/);
    expect(p[4]).toMatch(/d$/);
  });

  it("intervalLabel formats", () => {
    expect(intervalLabel(new Date(T0.getTime() + 600_000), T0)).toBe("10 min");
    expect(intervalLabel(new Date(T0.getTime() + 3 * 86400000), T0)).toBe("3 d");
    expect(intervalLabel(new Date(T0.getTime() + 90 * 86400000), T0)).toBe("3 mo");
  });
});
