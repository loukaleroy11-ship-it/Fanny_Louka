import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { fromCsv, parseLevel, parsePos } from "@/lib/exchange";
import { addVocabularyToCards, createUserCard, findDuplicates } from "@/lib/cards";

const schema = z.object({ csv: z.string().min(1).max(2_000_000), deckId: z.string().optional() });
const MAX_ROWS = 500;

export const POST = route(async ({ req, user }) => {
  const { csv, deckId } = await body(req, schema);
  if (deckId && !(await db.deck.findFirst({ where: { id: deckId, userId: user.id }, select: { id: true } }))) throw new ApiError(404, "Deck not found");
  const { records, errors } = fromCsv(csv);
  if (!records.length) throw new ApiError(400, errors[0] ?? "No valid rows", { errors });
  if (records.length > MAX_ROWS) throw new ApiError(400, `Maximum ${MAX_ROWS} rows per import`);

  let created = 0, linked = 0, duplicates = 0;
  for (const r of records) {
    const pos = parsePos(r.partOfSpeech || r.category);
    const dup = await findDuplicates(user.id, r.english, pos);
    const same = dup.exact.find((e) => e.vocabulary.pos === pos);
    if (same) {
      if (same.card) { duplicates++; continue; }
      await addVocabularyToCards(user.id, same.vocabulary.id, deckId);
      linked++;
      continue;
    }
    await createUserCard(user.id, {
      word: r.english, translation: r.french, example: r.example, exampleTranslation: r.exampleTranslation,
      pos, level: parseLevel(r.level), tags: r.tags, deckId, origin: "IMPORT",
    });
    created++;
  }
  return ok({ created, linked, duplicates, errors, total: records.length });
});
