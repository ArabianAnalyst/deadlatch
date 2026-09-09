import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "@/lib/db/test";
import { projects, projectKeys, monitors, flags, alerts } from "@/lib/db/schema";

describe("schema", () => {
  it("applies the migrations and round-trips a project, a key, a monitor, a flag and an alert", async () => {
    const db = await testDb();
    const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "ref", stream: "purse" }).returning();
    expect(p.alertQuietMs).toBe(21_600_000);
    await db.insert(projectKeys).values({ projectId: p.id, prefix: "aaaabbbb", hash: "h".repeat(64) });
    const dupKey = await db.insert(projectKeys).values({ projectId: p.id, prefix: "aaaabbbb", hash: "h".repeat(64) }).onConflictDoNothing().returning({ id: projectKeys.id });
    expect(dupKey).toHaveLength(0);
    await db.insert(monitors).values({ projectId: p.id, version: "0.3.1", stream: "purse", cursorSeq: 6, intervalMs: 60000 });
    const flag = { id: "f".repeat(64), projectId: p.id, expectationId: "executed-once", reason: "twice", offender: { action: "executed" }, cause: { amount: 1 }, ref: { stream: "purse", seq: 6, id: "x", hash: "0".repeat(64), ts: "2026-09-09T00:00:00.000Z" }, window: { fromSeq: 1, toSeq: 6, count: 6, matched: [] }, at: new Date("2026-09-09T00:00:00.000Z") };
    await db.insert(flags).values(flag);
    const dup = await db.insert(flags).values(flag).onConflictDoNothing().returning({ id: flags.id });
    expect(dup).toHaveLength(0);
    await db.insert(alerts).values({ projectId: p.id, flagId: flag.id, bucket: 0 });
    const again = await db.insert(alerts).values({ projectId: p.id, flagId: flag.id, bucket: 0 }).onConflictDoNothing().returning({ flagId: alerts.flagId });
    expect(again).toHaveLength(0);
    const [m] = await db.select().from(monitors).where(eq(monitors.projectId, p.id));
    expect(m.cursorSeq).toBe(6);
    const [k] = await db.select().from(projectKeys).where(eq(projectKeys.projectId, p.id));
    expect(k.revokedAt).toBeNull();
  });
  it("cascades a project's rows when the project is deleted", async () => {
    const db = await testDb();
    const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "ref", stream: "purse" }).returning();
    await db.insert(projectKeys).values({ projectId: p.id, prefix: "aaaabbbb", hash: "g".repeat(64) });
    await db.delete(projects).where(eq(projects.id, p.id));
    expect(await db.select().from(projectKeys)).toHaveLength(0);
  });
});
