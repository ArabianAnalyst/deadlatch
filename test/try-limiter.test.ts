import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "@/lib/db/test";
import { take, keyFor, WINDOW_MS, SPEND_LIMIT } from "@/lib/try/limiter";

let db: Awaited<ReturnType<typeof testDb>>;
beforeEach(async () => { db = await testDb(); });

describe("take", () => {
  it("lets thirty through and refuses the thirty-first with a retry time", async () => {
    const t0 = new Date("2026-09-11T10:00:00.000Z");
    for (let i = 1; i <= SPEND_LIMIT; i++) {
      const r = await take(db, "k1", SPEND_LIMIT, new Date(t0.getTime() + i * 1000));
      expect(r).toEqual({ ok: true, remaining: SPEND_LIMIT - i });
    }
    const r = await take(db, "k1", SPEND_LIMIT, new Date(t0.getTime() + 31_000));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBe(Math.ceil((WINDOW_MS - 30_000) / 1000));
  });
  it("opens a new window once the old one has passed", async () => {
    const t0 = new Date("2026-09-11T10:00:00.000Z");
    for (let i = 0; i < SPEND_LIMIT; i++) await take(db, "k2", SPEND_LIMIT, t0);
    expect((await take(db, "k2", SPEND_LIMIT, t0)).ok).toBe(false);
    const later = new Date(t0.getTime() + WINDOW_MS);
    expect(await take(db, "k2", SPEND_LIMIT, later)).toEqual({ ok: true, remaining: SPEND_LIMIT - 1 });
  });
  it("keeps keys apart", async () => {
    const t0 = new Date("2026-09-11T10:00:00.000Z");
    for (let i = 0; i < SPEND_LIMIT; i++) await take(db, "k3", SPEND_LIMIT, t0);
    expect((await take(db, "k3", SPEND_LIMIT, t0)).ok).toBe(false);
    expect((await take(db, "k4", SPEND_LIMIT, t0)).ok).toBe(true);
    expect((await take(db, "k3:status", 60, t0)).ok).toBe(true);
  });
  it("hashes an ip into a key and never stores the ip", () => {
    expect(keyFor("203.0.113.9")).toMatch(/^[0-9a-f]{64}$/);
    expect(keyFor("203.0.113.9")).not.toContain("203");
    expect(keyFor("203.0.113.9")).not.toBe(keyFor("203.0.113.10"));
  });
  it("forty calls at once admit exactly thirty", async () => {
    const t0 = new Date("2026-09-11T10:00:00.000Z");
    const results = await Promise.all(Array.from({ length: 40 }, () => take(db, "k5", SPEND_LIMIT, t0)));
    expect(results.filter((r) => r.ok)).toHaveLength(SPEND_LIMIT);
    expect(results.filter((r) => !r.ok)).toHaveLength(10);
    expect(await take(db, "k5", SPEND_LIMIT, new Date(t0.getTime() + WINDOW_MS))).toEqual({ ok: true, remaining: SPEND_LIMIT - 1 });
  });
});
