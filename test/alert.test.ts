import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "@/lib/db/test";
import { projects, flags, alerts } from "@/lib/db/schema";
import { maybeAlert, type Mailer } from "@/lib/watch/alert";

const ISO = "2026-09-09T12:00:00.000Z";
function fakeMailer(fail = false) {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const mailer: Mailer = { async send(m) { if (fail) throw new Error("resend down"); sent.push(m); } };
  return { mailer, sent };
}
const email = async (ownerId: string) => (ownerId === "user_a" ? "araba@example.com" : null);

let db: Awaited<ReturnType<typeof testDb>>;
let projectId: string;
beforeEach(async () => {
  db = await testDb();
  const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "reference broker", stream: "purse", alertQuietMs: 6 * 3_600_000 }).returning();
  projectId = p.id;
  for (const n of [1, 2, 3]) {
    const ref = { stream: "purse", seq: n, id: `id-${n}`, hash: "a".repeat(64), ts: ISO };
    await db.insert(flags).values({ id: `${n}`.padStart(64, "0"), projectId, expectationId: "payee-velocity", reason: "The same payee was paid too many times too quickly.", offender: { action: "executed", input: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, outcome: "ok", ref }, cause: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, ref, window: { fromSeq: 1, toSeq: n, count: n, matched: [] }, at: new Date(ISO) });
  }
});

describe("maybeAlert", () => {
  it("sends one plain email for the first flag after silence, records it, and names the expectation, the payee, the amount, the seq and the link", async () => {
    const { mailer, sent } = fakeMailer();
    const r = await maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], new Date("2026-09-09T12:00:10.000Z"), "https://www.deadlatch.dev");
    expect(r).toEqual({ sent: true, flagId: "1".padStart(64, "0") });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("araba@example.com");
    expect(sent[0].subject).toBe("Deadlatch, payee-velocity on reference broker");
    expect(sent[0].text).toContain("The same payee was paid too many times too quickly.");
    expect(sent[0].text).toContain("api.stripe.com");
    expect(sent[0].text).toContain("1250 USD");
    expect(sent[0].text).toContain("seq 1");
    expect(sent[0].text).toContain(`https://www.deadlatch.dev/app/${projectId}/flags/${"1".padStart(64, "0")}`);
    expect(await db.select().from(alerts)).toHaveLength(1);
  });
  it("stays quiet for the quiet period, then sends again", async () => {
    const { mailer, sent } = fakeMailer();
    await maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], new Date("2026-09-09T12:00:10.000Z"));
    const r2 = await maybeAlert(db, mailer, email, projectId, ["2".padStart(64, "0")], new Date("2026-09-09T15:00:00.000Z"));
    expect(r2).toEqual({ sent: false });
    const r3 = await maybeAlert(db, mailer, email, projectId, ["3".padStart(64, "0")], new Date("2026-09-09T18:00:11.000Z"));
    expect(r3.sent).toBe(true);
    expect(sent).toHaveLength(2);
  });
  it("picks the oldest flag of a batch and never sends twice for one flag", async () => {
    const { mailer, sent } = fakeMailer();
    await db.insert(alerts).values({ projectId, flagId: "2".padStart(64, "0"), bucket: Math.floor(Date.parse("2026-09-09T05:00:00.000Z") / (6 * 3_600_000)), sentAt: new Date("2026-09-09T05:00:00.000Z") });
    const r = await maybeAlert(db, mailer, email, projectId, ["2".padStart(64, "0"), "3".padStart(64, "0")], new Date("2026-09-09T12:00:00.000Z"));
    expect(r).toEqual({ sent: true, flagId: "3".padStart(64, "0") });
    expect(sent).toHaveLength(1);
  });
  it("does not record the alert when the provider fails, so the next flag retries", async () => {
    const { mailer } = fakeMailer(true);
    const r = await maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], new Date("2026-09-09T12:00:10.000Z"));
    expect(r).toEqual({ sent: false, error: "resend down" });
    expect(await db.select().from(alerts)).toHaveLength(0);
  });
  it("reports a missing owner email as an error and does nothing with no new flags", async () => {
    const { mailer, sent } = fakeMailer();
    const [p] = await db.insert(projects).values({ ownerId: "user_z", name: "x", stream: "s" }).returning();
    expect(await maybeAlert(db, mailer, email, p.id, ["1".padStart(64, "0")], new Date())).toEqual({ sent: false, error: "owner email not found" });
    expect(await maybeAlert(db, mailer, email, projectId, [], new Date())).toEqual({ sent: false });
    expect(sent).toHaveLength(0);
  });
  it("two concurrent batches with different flags in the same instant send exactly one email", async () => {
    const { mailer, sent } = fakeMailer();
    const now = new Date("2026-09-09T12:00:10.000Z");
    const results = await Promise.all([
      maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], now),
      maybeAlert(db, mailer, email, projectId, ["2".padStart(64, "0")], now),
    ]);
    expect(results.filter((r) => r.sent)).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(await db.select().from(alerts)).toHaveLength(1);
  });
});
