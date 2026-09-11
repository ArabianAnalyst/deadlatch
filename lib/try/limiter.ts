import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
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
 * Count one call against `key` in one atomic statement. The upsert resets or increments the count based on
 * whether the window has passed, all decided by Postgres on the row. A refused call increments the count but
 * never resets the window start, so the retry time stays exact. Safe across instances.
 */
export async function take(db: Db, key: string, limit: number, now: Date = new Date()): Promise<Take> {
  const [row] = await db
    .insert(tryLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: tryLimits.key,
      set: {
        windowStart: sql`CASE WHEN ${tryLimits.windowStart} + ${WINDOW_MS} * interval '1 millisecond' <= excluded.window_start THEN excluded.window_start ELSE ${tryLimits.windowStart} END`,
        count: sql`CASE WHEN ${tryLimits.windowStart} + ${WINDOW_MS} * interval '1 millisecond' <= excluded.window_start THEN 1 ELSE ${tryLimits.count} + 1 END`,
      },
    })
    .returning({ windowStart: tryLimits.windowStart, count: tryLimits.count });
  if (!row) throw new Error("try_limits upsert returned no row");
  if (row.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.windowStart.getTime() + WINDOW_MS - now.getTime()) / 1000)) };
  }
  return { ok: true, remaining: limit - row.count };
}
