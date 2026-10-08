import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword, sha256 } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

export const POST = route(
  async ({ req }) => {
    const { token, password } = await body(req, schema);
    const reset = await db.passwordReset.findUnique({ where: { tokenHash: await sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw new ApiError(400, "Lien invalide ou expiré.");
    await db.$transaction([
      db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
      db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      db.passwordReset.deleteMany({ where: { userId: reset.userId, usedAt: null } }),
    ]);
    return ok({ ok: true });
  },
  { auth: false },
);
