import { route, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route<{ id: string }>(async ({ user, params }) => {
  const c = await db.conversation.findFirst({ where: { id: params.id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!c) throw new ApiError(404, "Conversation not found");
  return ok({ conversation: c });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  const r = await db.conversation.deleteMany({ where: { id: params.id, userId: user.id } });
  if (!r.count) throw new ApiError(404, "Conversation not found");
  return ok({ ok: true });
});
