import { NextResponse } from "next/server";

export interface TryEnv { brokerUrl: string; witnessUrl: string; projectId: string; logKey: string }

/** The four server-only variables, or null when any is missing so a route can answer 503 instead of throwing. */
export function envFromProcess(): TryEnv | null {
  const { TRY_BROKER_URL, TRY_WITNESS_URL, TRY_PROJECT_ID, TRY_LOG_KEY } = process.env;
  if (!TRY_BROKER_URL || !TRY_WITNESS_URL || !TRY_PROJECT_ID || !TRY_LOG_KEY) return null;
  return { brokerUrl: TRY_BROKER_URL, witnessUrl: TRY_WITNESS_URL, projectId: TRY_PROJECT_ID, logKey: TRY_LOG_KEY };
}

/** The visitor's address as Vercel presents it. Hashed before it is stored, never logged. */
export function ipFrom(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** A fresh response each time. A Response body is consumed once, so this must not be a shared constant. */
export function notConfigured(): NextResponse {
  return NextResponse.json({ error: "playground not configured" }, { status: 503 });
}

/** Turn a handler reply into a response, with the CDN cache header on cacheable reads. */
export function reply(r: { status: number; body: unknown; cacheSec?: number }): NextResponse {
  const headers: Record<string, string> = r.cacheSec ? { "cache-control": `public, s-maxage=${r.cacheSec}, stale-while-revalidate=${r.cacheSec}` } : { "cache-control": "no-store" };
  return NextResponse.json(r.body, { status: r.status, headers });
}
