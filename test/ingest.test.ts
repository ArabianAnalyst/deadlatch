import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "@/lib/db/test";
import { projects, projectKeys, flags, monitors } from "@/lib/db/schema";
import { hashKey, keyPrefix } from "@/lib/watch/keys";
import { ingestFlags, heartbeat, validateFlag } from "@/lib/watch/ingest";

const KEY = "dl_live_aaaaaaaabbbbccccdddd";
const REVOKED = "dl_live_eeeeeeeeffffgggghhhh";
const ISO = "2026-09-09T12:00:00.000Z";
const NOW = () => new Date("2026-09-09T12:05:00.000Z");

function flag(seq: number, expectation = "executed-once") {
  const ref = { stream: "purse", seq, id: `id-${seq}`, hash: "a".repeat(64), ts: ISO };
  return { v: 1, id: `${seq}`.padStart(64, "0"), expectation: { id: expectation, reason: "A single-use grant executed twice." }, offender: { action: "executed", input: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, outcome: "ok", ref }, cause: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, window: { fromSeq: 1, toSeq: seq, count: seq, matched: [ref] }, at: ISO };
}
const body = (list: unknown[]) => ({ monitor: { version: "0.3.1", stream: "purse", intervalMs: 60000 }, flags: list });
const size = (x: unknown) => Buffer.byteLength(JSON.stringify(x));

let db: Awaited<ReturnType<typeof testDb>>;
let projectId: string;
beforeEach(async () => {
  db = await testDb();
  const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "ref", stream: "purse" }).returning();
  projectId = p.id;
  await db.insert(projectKeys).values({ projectId, prefix: keyPrefix(KEY), hash: hashKey(KEY) });
  await db.insert(projectKeys).values({ projectId, prefix: keyPrefix(REVOKED), hash: hashKey(REVOKED), revokedAt: new Date() });
});

describe("validateFlag", () => {
  it("accepts a real flag and names the first wrong field", () => {
    expect(validateFlag(flag(1), 0)).toBeNull();
    expect(validateFlag({ ...flag(1), id: "short" }, 0)).toEqual({ field: "id" });
    expect(validateFlag({ ...flag(1), expectation: { id: 3 } }, 0)).toEqual({ field: "expectation.id" });
    expect(validateFlag({ ...flag(1), offender: { action: "x" } }, 0)).toEqual({ field: "offender.ref" });
    expect(validateFlag({ ...flag(1), at: "yesterday" }, 0)).toEqual({ field: "at" });
    expect(validateFlag({ ...flag(1), window: { fromSeq: 1 } }, 0)).toEqual({ field: "window.toSeq" });
    expect(validateFlag(null, 0)).toEqual({ field: "" });
  });
});

describe("ingestFlags", () => {
  it("stores a batch under the key's project, answers 202 with accepted and duplicates, and updates the monitor", async () => {
    const r = await ingestFlags(db, `Bearer ${KEY}`, body([flag(1), flag(2)]), size(body([flag(1), flag(2)])), NOW);
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ accepted: 2, duplicates: 0 });
    expect(r.projectId).toBe(projectId);
    expect(r.newIds).toEqual([flag(1).id, flag(2).id]);
    const rows = await db.select().from(flags).where(eq(flags.projectId, projectId));
    expect(rows.map((x) => x.expectationId)).toEqual(["executed-once", "executed-once"]);
    expect(rows[0].at.toISOString()).toBe(ISO);
    const [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
    expect(m.version).toBe("0.3.1");
    expect(m.lastPushAt?.toISOString()).toBe(NOW().toISOString());
    expect(m.lastFlagAt?.toISOString()).toBe(ISO);
  });
  it("collapses a replayed batch to duplicates and reports no new ids", async () => {
    await ingestFlags(db, `Bearer ${KEY}`, body([flag(1)]), 10, NOW);
    const r = await ingestFlags(db, `Bearer ${KEY}`, body([flag(1), flag(3)]), 10, NOW);
    expect(r.body).toEqual({ accepted: 1, duplicates: 1 });
    expect(r.newIds).toEqual([flag(3).id]);
  });
  it("answers 401 for no key, a wrong key, or a malformed header, and 403 for a revoked key", async () => {
    expect((await ingestFlags(db, null, body([flag(1)]), 10, NOW)).status).toBe(401);
    expect((await ingestFlags(db, "Bearer dl_live_nope", body([flag(1)]), 10, NOW)).status).toBe(401);
    expect((await ingestFlags(db, `Token ${KEY}`, body([flag(1)]), 10, NOW)).status).toBe(401);
    expect((await ingestFlags(db, `Bearer ${REVOKED}`, body([flag(1)]), 10, NOW)).status).toBe(403);
    expect(await db.select().from(flags)).toHaveLength(0);
  });
  it("answers 413 over a megabyte or over a hundred flags, before touching the database", async () => {
    expect((await ingestFlags(db, `Bearer ${KEY}`, body([flag(1)]), 1_000_001, NOW)).status).toBe(413);
    const many = Array.from({ length: 101 }, (_, i) => flag(i + 1));
    expect((await ingestFlags(db, `Bearer ${KEY}`, body(many), 10, NOW)).status).toBe(413);
    expect(await db.select().from(flags)).toHaveLength(0);
  });
  it("answers 422 naming the first failing flag and field, and stores nothing from that batch", async () => {
    const r = await ingestFlags(db, `Bearer ${KEY}`, body([flag(1), { ...flag(2), at: "nope" }]), 10, NOW);
    expect(r.status).toBe(422);
    expect(r.body).toEqual({ error: "malformed flag", index: 1, field: "at" });
    expect(await db.select().from(flags)).toHaveLength(0);
    expect((await ingestFlags(db, `Bearer ${KEY}`, { flags: "x" }, 10, NOW)).body).toEqual({ error: "flags must be an array" });
    expect((await ingestFlags(db, `Bearer ${KEY}`, "not an object", 10, NOW)).status).toBe(422);
  });
  it("never lets the body choose the project", async () => {
    const [other] = await db.insert(projects).values({ ownerId: "user_b", name: "other", stream: "purse" }).returning();
    const r = await ingestFlags(db, `Bearer ${KEY}`, { ...body([flag(1)]), projectId: other.id, project: other.id }, 10, NOW);
    expect(r.status).toBe(202);
    const rows = await db.select().from(flags);
    expect(rows[0].projectId).toBe(projectId);
  });
});

describe("heartbeat", () => {
  it("upserts the monitor row and answers 204", async () => {
    const hb = { version: "0.3.1", stream: "purse", intervalMs: 60000, cursor: { seq: 6 }, lastFlagAt: null };
    expect((await heartbeat(db, `Bearer ${KEY}`, hb, NOW)).status).toBe(204);
    let [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
    expect(m.cursorSeq).toBe(6);
    expect(m.lastHeartbeatAt?.toISOString()).toBe(NOW().toISOString());
    expect(m.lastFlagAt).toBeNull();
    expect((await heartbeat(db, `Bearer ${KEY}`, { ...hb, cursor: { seq: 9 }, lastFlagAt: ISO }, NOW)).status).toBe(204);
    [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
    expect(m.cursorSeq).toBe(9);
    expect(m.lastFlagAt?.toISOString()).toBe(ISO);
  });
  it("answers 401, 403 and 422 like the flags route", async () => {
    expect((await heartbeat(db, null, {}, NOW)).status).toBe(401);
    expect((await heartbeat(db, `Bearer ${REVOKED}`, {}, NOW)).status).toBe(403);
    expect((await heartbeat(db, `Bearer ${KEY}`, { version: 1 }, NOW)).status).toBe(422);
  });
});
