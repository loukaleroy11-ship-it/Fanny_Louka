import { z } from "zod";
import { route, body, ok, ApiError, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { bootstrapUser } from "@/lib/cards";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { rateLimit, AUTH_LIMIT } from "@/lib/ratelimit";

const schema = z.object({ name: z.string().trim().min(1, "Nom requis").max(60), email: emailSchema, password: passwordSchema, timezone: z.string().max(60).optional() });

export const POST = route(
  async ({ req }) => {
    const rl = rateLimit(`register:${clientIp(req)}`, AUTH_LIMIT());
    if (!rl.ok) throw new ApiError(429, `Trop de tentatives. Réessayez dans ${rl.retryAfter}s.`);
    const input = await body(req, schema);
    if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw new ApiError(409, "Un compte existe déjà avec cet email.");
    }
    let timezone = "Europe/Paris";
    try {
      if (input.timezone) { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); timezone = input.timezone; }
    } catch { /* invalid tz → default */ }
    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password), timezone },
      select: { id: true },
    });
    await bootstrapUser(user.id);
    await createSession(user.id);
    return ok({ ok: true, next: "/placement" }, { status: 201 });
  },
  { auth: false },
);
