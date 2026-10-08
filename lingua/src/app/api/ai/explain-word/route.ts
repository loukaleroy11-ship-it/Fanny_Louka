import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { AIService } from "@/lib/ai/service";

const schema = z.object({
  word: z.string().trim().min(1).max(60),
  sentence: z.string().trim().max(500).default(""),
  mode: z.enum(["english", "french"]),
});

/** Click-a-word helper in conversations: "Explain in English" / "Translate to French". */
export const POST = route(
  async ({ req }) => {
    const { word, sentence, mode } = await body(req, schema);
    const r = await AIService.explainWord(word, sentence, mode);
    return ok({ text: r.data, mock: r.mock });
  },
  { ai: true },
);

// AI calls can take a while on serverless hosts (Vercel default is 10 s)
export const maxDuration = 60;
