import { z } from "zod";
import { route, body, ok } from "@/lib/api";
import { AIService } from "@/lib/ai/service";

const schema = z.object({ topic: z.string().trim().min(2).max(300) });

export const POST = route(
  async ({ req, user }) => {
    const { topic } = await body(req, schema);
    const r = await AIService.explainGrammar({ englishOnly: user.englishOnly }, topic);
    return ok({ text: r.data, mock: r.mock });
  },
  { ai: true },
);

// AI calls can take a while on serverless hosts (Vercel default is 10 s)
export const maxDuration = 60;
