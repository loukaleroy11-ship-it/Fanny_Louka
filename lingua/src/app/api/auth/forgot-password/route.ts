import { z } from "zod";
import { randomBytes } from "node:crypto";
import { route, body, ok, ApiError, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { sendResetEmail } from "@/lib/mail";
import { rateLimit, AUTH_LIMIT } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export const POST = route(
  async ({ req }) => {
    const rl = rateLimit(`forgot:${clientIp(req)}`, AUTH_LIMIT());
    if (!rl.ok) throw new ApiError(429, `Trop de tentatives. Réessayez dans ${rl.retryAfter}s.`);
    const { email } = await body(req, schema);
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    let devLink: string | undefined;
    if (user) {
      const token = randomBytes(32).toString("base64url");
      await db.passwordReset.create({
        data: { userId: user.id, tokenHash: await sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
      const sent = await sendResetEmail(email, link);
      if (!sent && process.env.NODE_ENV !== "production") devLink = link;
    }
    // Same response whether or not the account exists (no user enumeration).
    return ok({ ok: true, message: "Si un compte existe, un lien de réinitialisation a été envoyé.", devLink });
  },
  { auth: false },
);
