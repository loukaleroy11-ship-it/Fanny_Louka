import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ current: z.string().max(128), next: passwordSchema });

export const POST = route(async ({ req, user }) => {
  const { current, next } = await body(req, schema);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(current, row.passwordHash))) throw new ApiError(400, "Mot de passe actuel incorrect.");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return ok({ ok: true });
});
