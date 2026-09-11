import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "@/lib/db/test";
import { projects, flags, monitors } from "@/lib/db/schema";
import { publicWatch } from "@/lib/try/public";

let db: Awaited<ReturnType<typeof testDb>>;
beforeEach(async () => { db = await testDb(); });

async function seed(ownerId: string, name: string, n: number, base: Date) {
  const [p] = await db.insert(projects).values({ ownerId, name, stream: "playground" }).returning();
  for (let i = 0; i < n; i++) {
    const ref = { stream: "playground", seq: i, id: `id-${i}`, hash: "a".repeat(64), ts: base.toISOString() };
    await db.insert(flags).values({ id: `${name}-${i.toString().padStart(62, "0")}`, projectId: p.id, expectationId: "payee-velocity", reason: "The same payee was paid too many times too quickly.", offender: { action: "executed", ref }, cause: { payee: "api.stripe.com", amount: { amount: 1250, currency: "USD" } }, ref, window: { fromSeq: 0, toSeq: i, count: i + 1, matched: [] }, at: new Date(base.getTime() + i * 1000), receivedAt: new Date(base.getTime() + i * 1000) });
  }
  return p;
}

describe("publicWatch", () => {
  it("returns the monitor state and the newest ten flags of one project only", async () => {
    const base = new Date("2026-09-11T10:00:00.000Z");
    const a = await seed("user_a", "a", 12, base);
    await seed("user_b", "b", 3, base);
    await db.insert(monitors).values({ projectId: a.id, version: "0.3.2", stream: "playground", cursorSeq: 40, intervalMs: 15000, lastHeartbeatAt: new Date(base.getTime() + 20_000) });
    const w = await publicWatch(db, a.id, new Date(base.getTime() + 25_000));
    expect(w.monitor.state).toBe("ok");
    expect(w.monitor.cursorSeq).toBe(40);
    expect(w.flags).toHaveLength(10);
    expect(w.flags[0]!.ref.seq).toBe(11);
    expect(w.flags.every((f) => f.id.startsWith("a-"))).toBe(true);
    expect(w.flags[0]!.payee).toBe("api.stripe.com");
  });
  it("answers never and an empty list for a project with nothing", async () => {
    const p = await seed("user_c", "c", 0, new Date());
    expect(await publicWatch(db, p.id)).toEqual({ monitor: { state: "never", version: null, cursorSeq: null, lastHeartbeatAt: null, intervalMs: null, lastAlertAt: null, lastAlertError: null }, flags: [] });
  });
});
