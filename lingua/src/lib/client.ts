"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiClientError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

/** fetch wrapper: JSON in/out, throws ApiClientError with the server message. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiClientError(res.status, (data.error as string) ?? `Erreur ${res.status}`, data);
  return data as T;
}

const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Tiny SWR-style hook: de-duplicates in-flight requests, serves cached data instantly while revalidating,
 * and keeps stale data on screen while a refresh runs (no flicker, no redundant API calls).
 */
export function useApi<T>(url: string | null, opts: { ttl?: number } = {}) {
  const ttl = opts.ttl ?? 15_000;
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>(() => {
    const c = url ? cache.get(url) : undefined;
    return { data: c?.data as T | undefined, loading: !c };
  });
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async (force = false) => {
    const u = urlRef.current;
    if (!u) return;
    const c = cache.get(u);
    if (c && !force && Date.now() - c.at < ttl) {
      setState({ data: c.data as T, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: !c, error: undefined }));
    try {
      let p = inflight.get(u) as Promise<T> | undefined;
      if (!p) {
        p = api<T>(u).finally(() => inflight.delete(u));
        inflight.set(u, p);
      }
      const data = await p;
      cache.set(u, { at: Date.now(), data });
      if (urlRef.current === u) setState({ data, loading: false });
    } catch (e) {
      if (urlRef.current === u) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Erreur" }));
    }
  }, [ttl]);

  useEffect(() => {
    void load();
  }, [url, load]);

  return { ...state, reload: () => load(true), mutate: (data: T) => { if (url) cache.set(url, { at: Date.now(), data }); setState({ data, loading: false }); } };
}

export const invalidate = (prefix: string) => {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
};

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
