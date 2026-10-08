import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ kind: z.enum(["COGNATE", "FALSE_FRIEND"]).optional(), q: z.string().max(60).optional() });

export const GET = route(async ({ req }) => {
  const { kind, q } = query(req, schema);
  const items = await db.cognate.findMany({
    where: { ...(kind && { kind }), ...(q && { OR: [{ english: { contains: q, mode: "insensitive" } }, { french: { contains: q, mode: "insensitive" } }] }) },
    orderBy: { english: "asc" },
  });
  return ok({ items }, { headers: { "Cache-Control": "private, max-age=300" } });
});
