/**
 * Minimal in-memory sliding-window rate limiter.
 * Per-instance only: behind several instances/serverless workers, swap for Redis/Upstash
 * (same `rateLimit(key, limit, windowMs)` signature).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

export const AI_LIMIT = () => Number(process.env.RATE_LIMIT_AI_PER_MIN ?? 20);
export const AUTH_LIMIT = () => Number(process.env.RATE_LIMIT_AUTH_PER_MIN ?? 10);
