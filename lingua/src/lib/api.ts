import { NextRequest, NextResponse } from "next/server";
import { z, ZodError, ZodType } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth";
import { rateLimit, AI_LIMIT } from "./ratelimit";

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

type Ctx<P> = { params: Promise<P> };

interface Opts {
  /** Require a signed-in user (default true). */
  auth?: boolean;
  /** Apply the AI rate limit (calls that hit an LLM). */
  ai?: boolean;
}

/** Wraps a route handler with auth, error handling and uniform JSON errors. */
export function route<P = Record<string, string>>(
  handler: (args: { req: NextRequest; user: CurrentUser; params: P }) => Promise<Response>,
  opts: Opts = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const found = opts.auth === false ? null : await getCurrentUser();
      if (opts.auth !== false && !found) throw new ApiError(401, "Not authenticated");
      // Routes declared with `auth: false` must not read `user`.
      const user = found as CurrentUser;
      if (opts.ai) {
        const rl = rateLimit(`ai:${user.id}`, AI_LIMIT());
        if (!rl.ok) throw new ApiError(429, `Too many AI requests. Retry in ${rl.retryAfter}s.`);
      }
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await handler({ req, user, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  console.error("[api]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function body<T extends ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  return schema.parse(raw);
}

export function query<T extends ZodType>(req: NextRequest, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}
