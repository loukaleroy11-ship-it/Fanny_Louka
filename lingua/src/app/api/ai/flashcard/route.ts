import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { AIService } from "@/lib/ai/service";

const schema = z.object({ word: z.string().trim().min(1).max(80) });

/** "Generate with AI": returns an editable draft — nothing is saved until the learner confirms. */
export const POST = route(
  async ({ req }) => {
    const { word } = await body(req, schema);
    const r = await AIService.generateFlashcard(word);
    return ok({ draft: r.data, mock: r.mock, warning: r.warning });
  },
  { ai: true },
);

// AI calls can take a while on serverless hosts (Vercel default is 10 s)
export const maxDuration = 60;
