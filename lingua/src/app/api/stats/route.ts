import { z } from "zod";
import { route, query, ok } from "@/lib/api";
import { getStats } from "@/lib/stats";

const schema = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });

export const GET = route(async ({ req, user }) => {
  const { days } = query(req, schema);
  return ok(await getStats(user.id, days));
});
