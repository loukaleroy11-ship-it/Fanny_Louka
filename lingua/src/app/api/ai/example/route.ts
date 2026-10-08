import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { AIService } from "@/lib/ai/service";

const schema = z.object({ word: z.string().trim().min(1).max(60), level: z.string().max(3).default("B1") });

export const POST = route(
  async ({ req }) => {
    const { word, level } = await body(req, schema);
    const r = await AIService.generateExample(word, level);
    return ok({ ...r.data, mock: r.mock });
  },
  { ai: true },
);
