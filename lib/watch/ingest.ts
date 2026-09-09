import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/types";
import { flags, monitors, projectKeys } from "@/lib/db/schema";
import { hashKey, KEY_PREFIX } from "./keys";
import { validateFlag as validateShape, type WireFlag } from "./flag-shape";

export const MAX_FLAGS = 100;
export const MAX_BYTES = 4_000_000;

export type KeyResolution = { status: 401 | 403 } | { projectId: string };

/** The project behind a bearer key. 401 when absent, malformed, or unknown; 403 when revoked. */
export async function resolveKey(db: Db, authorization: string | null): Promise<KeyResolution> {
  if (!authorization?.startsWith("Bearer ")) return { status: 401 };
  const key = authorization.slice(7).trim();
  if (!key.startsWith(KEY_PREFIX)) return { status: 401 };
  const [row] = await db.select({ projectId: projectKeys.projectId, revokedAt: projectKeys.revokedAt }).from(projectKeys).where(eq(projectKeys.hash, hashKey(key)));
  if (!row) return { status: 401 };
  if (row.revokedAt) return { status: 403 };
  return { projectId: row.projectId };
}

/** Re-exported so the tests and the route name one function. The index argument is accepted for symmetry and unused. */
export function validateFlag(x: unknown, _index?: number): { field: string } | null {
  return validateShape(x);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

interface MonitorMeta { version: string | null; stream: string | null; intervalMs: number | null }
function monitorMeta(raw: Record<string, unknown>): MonitorMeta {
  const m = isObj(raw.monitor) ? raw.monitor : {};
  return {
    version: typeof m.version === "string" ? m.version : null,
    stream: typeof m.stream === "string" ? m.stream : null,
    intervalMs: typeof m.intervalMs === "number" ? m.intervalMs : null,
  };
}

export interface IngestResult { status: number; body: unknown; projectId?: string; newIds?: string[] }

export async function ingestFlags(db: Db, authorization: string | null, raw: unknown, byteLength: number, now: () => Date = () => new Date()): Promise<IngestResult> {
  if (byteLength > MAX_BYTES) return { status: 413, body: { error: `body over ${MAX_BYTES} bytes` } };
  const key = await resolveKey(db, authorization);
  if ("status" in key) return { status: key.status, body: { error: key.status === 401 ? "unknown key" : "revoked key" } };
  if (!isObj(raw)) return { status: 422, body: { error: "body must be an object" } };
  if (!Array.isArray(raw.flags)) return { status: 422, body: { error: "flags must be an array" } };
  if (raw.flags.length > MAX_FLAGS) return { status: 413, body: { error: `at most ${MAX_FLAGS} flags per request` } };
  for (const [index, f] of raw.flags.entries()) {
    const bad = validateShape(f);
    if (bad) return { status: 422, body: { error: "malformed flag", index, field: bad.field } };
  }
  const list = raw.flags as WireFlag[];
  const at = now();
  let inserted: { id: string }[] = [];
  if (list.length > 0) {
    inserted = await db
      .insert(flags)
      .values(list.map((f) => ({ id: f.id, projectId: key.projectId, expectationId: f.expectation.id, reason: f.expectation.reason, offender: f.offender, cause: f.cause ?? null, ref: f.offender.ref, window: f.window, at: new Date(f.at) })))
      .onConflictDoNothing()
      .returning({ id: flags.id });
  }
  const newest = list.reduce<Date | null>((m, f) => { const d = new Date(f.at); return m && m > d ? m : d; }, null);
  const meta = monitorMeta(raw);
  await db
    .insert(monitors)
    .values({ projectId: key.projectId, version: meta.version, stream: meta.stream, intervalMs: meta.intervalMs, lastPushAt: at, lastFlagAt: newest })
    .onConflictDoUpdate({
      target: monitors.projectId,
      set: {
        version: sql`coalesce(excluded.version, ${monitors.version})`,
        stream: sql`coalesce(excluded.stream, ${monitors.stream})`,
        intervalMs: sql`coalesce(excluded.interval_ms, ${monitors.intervalMs})`,
        lastPushAt: at,
        lastFlagAt: sql`greatest(coalesce(${monitors.lastFlagAt}, 'epoch'::timestamptz), coalesce(excluded.last_flag_at, 'epoch'::timestamptz))`,
      },
    });
  const newIds = inserted.map((r) => r.id);
  return { status: 202, body: { accepted: newIds.length, duplicates: list.length - newIds.length }, projectId: key.projectId, newIds };
}

export interface HeartbeatResult { status: number; body?: unknown }

export async function heartbeat(db: Db, authorization: string | null, raw: unknown, now: () => Date = () => new Date()): Promise<HeartbeatResult> {
  const key = await resolveKey(db, authorization);
  if ("status" in key) return { status: key.status, body: { error: key.status === 401 ? "unknown key" : "revoked key" } };
  if (!isObj(raw)) return { status: 422, body: { error: "body must be an object" } };
  if (typeof raw.version !== "string" || typeof raw.stream !== "string" || typeof raw.intervalMs !== "number") return { status: 422, body: { error: "version, stream and intervalMs are required" } };
  const cursor = isObj(raw.cursor) && typeof raw.cursor.seq === "number" ? raw.cursor.seq : null;
  const lastFlagAt = typeof raw.lastFlagAt === "string" && !Number.isNaN(Date.parse(raw.lastFlagAt)) ? new Date(raw.lastFlagAt) : null;
  const at = now();
  await db
    .insert(monitors)
    .values({ projectId: key.projectId, version: raw.version, stream: raw.stream, intervalMs: raw.intervalMs, cursorSeq: cursor, lastHeartbeatAt: at, lastFlagAt })
    .onConflictDoUpdate({ target: monitors.projectId, set: { version: raw.version, stream: raw.stream, intervalMs: raw.intervalMs, cursorSeq: cursor, lastHeartbeatAt: at, lastFlagAt: sql`coalesce(excluded.last_flag_at, ${monitors.lastFlagAt})` } });
  return { status: 204 };
}
