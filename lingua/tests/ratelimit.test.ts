import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

describe("rate limiter", () => {
  it("allows up to the limit then blocks with retry-after", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const r = rateLimit(key, 3, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });
  it("keys are independent and the window slides", async () => {
    const a = `a-${Math.random()}`, b = `b-${Math.random()}`;
    rateLimit(a, 1, 50);
    expect(rateLimit(a, 1, 50).ok).toBe(false);
    expect(rateLimit(b, 1, 50).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 70));
    expect(rateLimit(a, 1, 50).ok).toBe(true);
  });
});
