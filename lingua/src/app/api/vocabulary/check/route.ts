import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { findDuplicates } from "@/lib/cards";
import { vocabDto } from "@/lib/serialize";
import { posEnum } from "@/lib/validation";

const schema = z.object({ word: z.string().max(120), pos: posEnum.optional() });

/** Live duplicate check used while typing a new card. */
export const GET = route(async ({ req, user }) => {
  const { word, pos } = query(req, schema);
  const d = await findDuplicates(user.id, word, pos);
  return ok(
    {
      normalized: d.normalized,
      exists: d.exact.length > 0,
      exact: d.exact.map((e) => ({
        vocabulary: vocabDto(e.vocabulary),
        card: e.card,
      })),
      related: d.related.map((r) => ({ relation: r.relation, vocabulary: vocabDto(r.vocabulary) })),
    },
    { headers: { "Cache-Control": "private, max-age=5" } },
  );
});
