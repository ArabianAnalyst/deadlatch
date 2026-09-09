import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "@/lib/db/test";
import { projects, projectKeys, monitors, flags } from "@/lib/db/schema";
import { hashKey } from "@/lib/watch/keys";
import { projectsFor, createProject, projectFor, dashboard, flagFor, acknowledge, rotateKey, keyInfo, setQuiet } from "@/lib/watch/queries";
import { configLines } from "@/lib/watch/config-lines";

const NOW = new Date("2026-09-09T12:00:00.000Z");
let db: Awaited<ReturnType<typeof testDb>>;
beforeEach(async () => { db = await testDb(); });

async function seedFlags(projectId: string, list: Array<{ n: number; expectation: string; hoursAgo: number }>) {
  for (const f of list) {
    const at = new Date(NOW.getTime() - f.hoursAgo * 3_600_000);
    const ref = { stream: "purse", seq: f.n, id: `id-${f.n}`, hash: "a".repeat(64), ts: at.toISOString() };
    await db.insert(flags).values({ id: `${f.n}`.padStart(64, "0"), projectId, expectationId: f.expectation, reason: "r", offender: { action: "executed", ref }, cause: { payee: "api.stripe.com", amount: { amount: 1250, currency: "USD" } }, ref, window: { fromSeq: 1, toSeq: f.n, count: f.n, matched: [] }, at, receivedAt: at });
  }
}

describe("projects and keys", () => {
  it("creates a project with one key shown once, lists it for its owner only, and scopes lookups by owner", async () => {
    const { project, key } = await createProject(db, "user_a", "reference broker", "purse");
    expect(key.startsWith("dl_live_")).toBe(true);
    const [k] = await db.select().from(projectKeys).where(eq(projectKeys.projectId, project.id));
    expect(k.hash).toBe(hashKey(key));
    expect(k.prefix).toBe(key.slice(8, 16));
    expect((await projectsFor(db, "user_a")).map((p) => p.name)).toEqual(["reference broker"]);
    expect(await projectsFor(db, "user_b")).toEqual([]);
    expect((await projectFor(db, "user_a", project.id))?.id).toBe(project.id);
    expect(await projectFor(db, "user_b", project.id)).toBeNull();
  });
  it("rotates the key, revoking the old one, and keyInfo reports the live one", async () => {
    const { project, key } = await createProject(db, "user_a", "p", "purse");
    const rotated = await rotateKey(db, "user_a", project.id);
    expect(rotated.key).not.toBe(key);
    const rows = await db.select().from(projectKeys).where(eq(projectKeys.projectId, project.id));
    expect(rows.filter((r) => r.revokedAt).map((r) => r.hash)).toEqual([hashKey(key)]);
    expect((await keyInfo(db, project.id))?.prefix).toBe(rotated.prefix);
    expect(configLines(rotated.key, "purse", "https://www.deadlatch.dev")).toBe(`DEADLATCH_URL=https://www.deadlatch.dev\nDEADLATCH_PROJECT_KEY=${rotated.key}\nMONITOR_STREAM=purse`);
    expect(configLines(null, "purse", "https://www.deadlatch.dev")).toContain("DEADLATCH_PROJECT_KEY=<shown once when the key was made>");
  });
  it("setQuiet bounds the period to one minute or more", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    await setQuiet(db, "user_a", project.id, 3_600_000);
    expect((await projectFor(db, "user_a", project.id))?.alertQuietMs).toBe(3_600_000);
    await expect(setQuiet(db, "user_a", project.id, 5)).rejects.toThrow(/at least/);
  });
});

describe("dashboard", () => {
  it("reports never before a heartbeat, then ok, amber past two intervals, red past three", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("never");
    await db.insert(monitors).values({ projectId: project.id, version: "0.3.1", stream: "purse", cursorSeq: 6, intervalMs: 60_000, lastHeartbeatAt: new Date(NOW.getTime() - 30_000) });
    await db.update(monitors).set({ lastAlertError: "resend down" }).where(eq(monitors.projectId, project.id));
    expect((await dashboard(db, project.id, NOW)).monitor.lastAlertError).toBe("resend down");
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("ok");
    await db.update(monitors).set({ lastHeartbeatAt: new Date(NOW.getTime() - 150_000) }).where(eq(monitors.projectId, project.id));
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("amber");
    await db.update(monitors).set({ lastHeartbeatAt: new Date(NOW.getTime() - 200_000) }).where(eq(monitors.projectId, project.id));
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("red");
  });
  it("counts flags by expectation over a day and a week and lists the newest first", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    await seedFlags(project.id, [{ n: 1, expectation: "executed-once", hoursAgo: 1 }, { n: 2, expectation: "payee-velocity", hoursAgo: 2 }, { n: 3, expectation: "payee-velocity", hoursAgo: 30 }, { n: 4, expectation: "executed-once", hoursAgo: 200 }]);
    const d = await dashboard(db, project.id, NOW);
    expect(d.counts.day).toEqual({ "executed-once": 1, "payee-velocity": 1 });
    expect(d.counts.week).toEqual({ "executed-once": 1, "payee-velocity": 2 });
    expect(d.recent.map((f) => f.ref.seq)).toEqual([1, 2, 3, 4]);
    expect(d.recent[0].payee).toBe("api.stripe.com");
    expect(d.recent[0].amount).toBe("1250 USD");
  });
  it("orders flags of one batch by receipt seq, newest seq first", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    await seedFlags(project.id, [{ n: 5, expectation: "executed-once", hoursAgo: 1 }, { n: 9, expectation: "executed-once", hoursAgo: 1 }, { n: 7, expectation: "executed-once", hoursAgo: 1 }]);
    expect((await dashboard(db, project.id, NOW)).recent.map((f) => f.ref.seq)).toEqual([9, 7, 5]);
  });
});

describe("flag detail", () => {
  it("returns a flag only within its project and acknowledges once", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    const other = await createProject(db, "user_b", "q", "purse");
    await seedFlags(project.id, [{ n: 1, expectation: "executed-once", hoursAgo: 1 }]);
    const id = "1".padStart(64, "0");
    expect((await flagFor(db, project.id, id))?.expectationId).toBe("executed-once");
    expect(await flagFor(db, other.project.id, id)).toBeNull();
    await acknowledge(db, "user_a", project.id, id, NOW);
    expect((await flagFor(db, project.id, id))?.acknowledgedAt?.toISOString()).toBe(NOW.toISOString());
    await acknowledge(db, "user_a", project.id, id, new Date(NOW.getTime() + 1000));
    expect((await flagFor(db, project.id, id))?.acknowledgedAt?.toISOString()).toBe(NOW.toISOString());
  });
});

describe("ownership in the query layer", () => {
  it("a stranger cannot rotate, requiet or acknowledge another owner's project", async () => {
    const { project, key } = await createProject(db, "user_a", "p", "purse");
    await seedFlags(project.id, [{ n: 1, expectation: "executed-once", hoursAgo: 1 }]);
    const id = "1".padStart(64, "0");
    await expect(rotateKey(db, "user_b", project.id)).rejects.toThrow(/not your project/);
    expect((await keyInfo(db, project.id))?.prefix).toBe(key.slice(8, 16));
    await expect(setQuiet(db, "user_b", project.id, 3_600_000)).rejects.toThrow(/not your project/);
    await acknowledge(db, "user_b", project.id, id, NOW);
    expect((await flagFor(db, project.id, id))?.acknowledgedAt).toBeNull();
  });
  it("setQuiet refuses more than thirty days", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    await expect(setQuiet(db, "user_a", project.id, 31 * 24 * 3_600_000)).rejects.toThrow(/at most thirty days/);
  });
});
