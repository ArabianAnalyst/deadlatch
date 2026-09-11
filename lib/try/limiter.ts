import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/types";
import { tryLimits } from "@/lib/db/schema";

export const WINDOW_MS = 600_000;
export const SPEND_LIMIT = 30;
export const STATUS_LIMIT = 60;

export type Take = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

/** A visitor's bucket key. The ip is hashed once and never stored. */
export function keyFor(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Count one call against `key`. A window is `WINDOW_MS` from its first call. Inside the window the count
 * grows to `limit`, the call after that is refused with the seconds until the window ends. Once the window
 * has passed the next call starts a new one. One upsert per call, safe across instances, which is why this
 * lives in Postgres and not in memory.
 */
export async function take(db: Db, key: string, limit: number, now: Date = new Date()): Promise<Take> {
  const [row] = await db.select().from(tryLimits).where(eq(tryLimits.key, key));
  const fresh = !row || row.windowStart.getTime() + WINDOW_MS <= now.getTime();
  if (fresh) {
    await db.insert(tryLimits).values({ key, windowStart: now, count: 1 }).onConflictDoUpdate({ target: tryLimits.key, set: { windowStart: now, count: 1 } });
    return { ok: true, remaining: limit - 1 };
  }
  if (row.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.windowStart.getTime() + WINDOW_MS - now.getTime()) / 1000)) };
  }
  await db.update(tryLimits).set({ count: sql`${tryLimits.count} + 1` }).where(eq(tryLimits.key, key));
  return { ok: true, remaining: limit - row.count - 1 };
}
