import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { SYSTEM_DECK_NAMES } from "@/lib/catalog";
import { deckStats } from "@/lib/deckstats";
import { dayBounds, localDate } from "@/lib/time";

export const GET = route<{ id: string }>(async ({ user, params }) => {
  const deck = await db.deck.findFirst({ where: { id: params.id, userId: user.id } });
  if (!deck) throw new ApiError(404, "Deck not found");
  const { end } = dayBounds(localDate(new Date(), user.timezone), user.timezone);
  const s = (await deckStats(user.id, end)).get(deck.id);
  return ok({ deck: { ...deck, ...(s ?? { total: 0, newCards: 0, due: 0, mastered: 0, learned: 0 }) } });
});

const patchSchema = z.object({ name: z.string().trim().min(1).max(60).optional(), description: z.string().trim().max(200).nullish() });
const isSystem = (d: { kind: string; name: string }) => d.kind !== "CUSTOM" || d.name === SYSTEM_DECK_NAMES.words;

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, patchSchema);
  const deck = await db.deck.findFirst({ where: { id: params.id, userId: user.id } });
  if (!deck) throw new ApiError(404, "Deck not found");
  if (isSystem(deck) && input.name) throw new ApiError(403, "System decks cannot be renamed");
  const updated = await db.deck.update({ where: { id: deck.id }, data: { ...(input.name && { name: input.name }), ...(input.description !== undefined && { description: input.description || null }) } });
  return ok({ deck: updated });
});

/** Deleting a deck never deletes the cards (and their review history): they just leave the deck. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  const deck = await db.deck.findFirst({ where: { id: params.id, userId: user.id } });
  if (!deck) throw new ApiError(404, "Deck not found");
  if (isSystem(deck)) throw new ApiError(403, "System decks cannot be deleted");
  await db.deck.delete({ where: { id: deck.id } });
  return ok({ ok: true });
});
