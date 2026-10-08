import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { mistakeSummary } from "@/lib/mistakes";

const schema = z.object({ page: z.coerce.number().int().min(1).default(1), converted: z.enum(["yes", "no"]).optional() });

export const GET = route(async ({ req, user }) => {
  const { page, converted } = query(req, schema);
  const where = { userId: user.id, ...(converted === "yes" ? { flashcardId: { not: null } } : converted === "no" ? { flashcardId: null } : {}) };
  const [items, total, summary] = await Promise.all([
    db.mistake.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { skill: { select: { slug: true, name: true } } } }),
    db.mistake.count({ where }),
    mistakeSummary(user.id, 10),
  ]);
  return ok({ items, total, summary });
});
