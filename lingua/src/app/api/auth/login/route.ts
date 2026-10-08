import { z } from "zod";
import { route, body, ok, ApiError, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit, AUTH_LIMIT } from "@/lib/ratelimit";
import { ensureBootstrapped } from "@/lib/cards";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(128) });
// Keeps timing similar whether or not the account exists.
let dummy: Promise<string> | undefined;

export const POST = route(
  async ({ req }) => {
    const input = await body(req, schema);
    const rl = rateLimit(`login:${clientIp(req)}:${input.email}`, AUTH_LIMIT());
    if (!rl.ok) throw new ApiError(429, `Trop de tentatives. Réessayez dans ${rl.retryAfter}s.`);
    const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, passwordHash: true, placementDone: true } });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? (await (dummy ??= hashPassword("not-a-real-password"))));
    if (!user || !valid) throw new ApiError(401, "Email ou mot de passe incorrect.");
    // Creates / completes the system decks and the 500-word deck if needed (no-op otherwise).
    await ensureBootstrapped(user.id);
    await createSession(user.id);
    return ok({ ok: true, next: user.placementDone ? "/dashboard" : "/placement" });
  },
  { auth: false },
);
