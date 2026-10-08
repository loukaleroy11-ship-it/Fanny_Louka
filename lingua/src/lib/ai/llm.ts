/**
 * Thin server-side client for the LLM (Anthropic Messages API).
 * The API key is read from the environment and never leaves the server.
 * Without a key (or with AI_FORCE_MOCK=true) callers must fall back to the mock implementations.
 */
export class NoLLMError extends Error {
  constructor() {
    super("No LLM configured");
  }
}

export const isMockMode = () => process.env.AI_FORCE_MOCK === "true" || !process.env.ANTHROPIC_API_KEY;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CompleteOpts {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export async function complete({ system, messages, maxTokens = 700, temperature = 0.6 }: CompleteOpts): Promise<string> {
  if (isMockMode()) throw new NoLLMError();
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    }
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`LLM request failed (${res.status}): ${detail}`);
  }
  throw new Error("LLM request failed");
}

/** Extracts the first JSON object/array from a model reply (tolerates ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.search(/[{[]/);
  if (start < 0) throw new Error("No JSON in model reply");
  const open = src[start];
  const close = open === "{" ? "}" : "]";
  const end = src.lastIndexOf(close);
  return JSON.parse(src.slice(start, end + 1));
}
