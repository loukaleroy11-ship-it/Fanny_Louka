import { z } from "zod";
import { route, body, ok, ApiError } from "@/lib/api";
import { CATALOG } from "@/lib/catalog";
import { installCatalogDeck } from "@/lib/cards";

const schema = z.object({ key: z.string().max(40) });

export const POST = route(async ({ req, user }) => {
  const { key } = await body(req, schema);
  if (!CATALOG.some((c) => c.key === key)) throw new ApiError(404, "Unknown deck");
  const r = await installCatalogDeck(user.id, key);
  return ok({ deck: r.deck, added: r.added, total: r.total }, { status: 201 });
});
