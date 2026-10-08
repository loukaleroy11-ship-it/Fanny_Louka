import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { addVocabularyToCards } from "@/lib/cards";

const schema = z.object({ vocabularyId: z.string().min(1), deckId: z.string().optional() });

/** "Add to cards" / "Study existing card": links a lexicon entry to the learner's cards (idempotent). */
export const POST = route(async ({ req, user }) => {
  const { vocabularyId, deckId } = await body(req, schema);
  const r = await addVocabularyToCards(user.id, vocabularyId, deckId);
  if (!r) throw new ApiError(404, "Word not found");
  return ok({ cardId: r.card.id, created: r.created }, { status: r.created ? 201 : 200 });
});
