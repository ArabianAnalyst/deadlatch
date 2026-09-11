import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "@/lib/db/test";
import { projects } from "@/lib/db/schema";
import { request, execute, status, chain, anchor, flags, type TryDeps } from "@/lib/try/handlers";
import { SPEND_LIMIT } from "@/lib/try/limiter";
import type { Db } from "@/lib/db/types";

type Route = (url: string, body?: unknown) => Response | never;
function fakeFetch(route: Route): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => route(String(input), init?.body ? JSON.parse(String(init.body)) : undefined)) as typeof fetch;
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

const HASH = "d4bd87553812292c09750eef6ae72137687180710133495a3144191060bd1afc";
const rec = (i: number) => ({ id: `id-${i}`, ts: "2026-09-11T00:00:00.000Z", kind: "decision", payload: { status: "allowed", reason: "executed", grantId: "g_12345678" }, prevHash: i ? "b".repeat(64) : "0".repeat(64), hash: HASH });
const ANCHOR = { v: 1, stream: "playground", seq: 27, head: HASH, at: "2026-09-11T00:05:00.000Z", witness: { alg: "ecdsa-p256", publicKey: "WITKEY" }, signature: "sig", log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "kid" }, entry: { logIndex: "101844748", canonicalizedBody: "x" }, proof: {} };

function broker(url: string, body?: unknown): Response {
  if (url.endsWith("/request")) {
    const b = body as { amount: string; payee: string };
    if (b.payee !== "api.stripe.com") return json({ decision: "denied", reason: `denied: payee "${b.payee}" is not on the allowlist`, explain: { rule: "allowlist-miss", policyVersion: "v" } });
    if (b.amount === "$75.00") return json({ decision: "denied", reason: "denied: 75.00 USD exceeds the per-action cap of 50.00 USD", explain: { rule: "per-action-cap", policyVersion: "v" } });
    if (b.amount === "$35.00") return json({ decision: "needs_approval", pendingId: "p_12345678", reason: "held", explain: { rule: "require-approval", policyVersion: "v" } });
    return json({ decision: "allowed", grantId: "g_12345678", reason: "within policy", explain: { rule: "within-policy", policyVersion: "v" } });
  }
  if (url.endsWith("/execute")) return json({ status: "paid", reason: "executed", receipt: { ok: true, ref: "mock-1", paidAmount: { amount: 1250, currency: "USD" } } });
  if (url.endsWith("/status")) return json({ state: "pending" });
  if (url.endsWith(":8082/")) return json({ stream: "playground", witness: { publicKey: "WITKEY" }, log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "kid" } });
  if (url.includes("/chain")) { const u = new URL(url); const since = Number(u.searchParams.get("since") ?? 0); const limit = Number(u.searchParams.get("limit") ?? 100); const total = 30; const from = Math.min(since, total); const records = []; for (let i = from; i < Math.min(total, from + limit); i++) records.push(rec(i)); return json({ stream: "playground", total, head: { seq: 29, hash: HASH }, since: from, count: records.length, records }); }
  if (url.includes("/anchors")) return json({ stream: "playground", anchors: [ANCHOR] });
  if (url.endsWith("/verify")) return json({ ok: true, coveredUpTo: 27, anchors: [], chain: { ok: true }, stream: "playground" });
  return json({ error: "not found" }, 404);
}

let db: Awaited<ReturnType<typeof testDb>>;
let deps: TryDeps;
let projectId: string;
beforeEach(async () => {
  db = await testDb();
  const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "playground", stream: "playground" }).returning();
  projectId = p.id;
  deps = { db, fetch: fakeFetch(broker), env: { brokerUrl: "https://b.test", witnessUrl: "https://b.test:8082", projectId, logKey: "log2025-1.rekor.sigstore.dev=LOGKEY" }, now: () => new Date("2026-09-11T10:00:00.000Z") };
});

describe("request", () => {
  it("sends the preset body and returns the decision with a curl", async () => {
    const r = await request(deps, "203.0.113.9", { preset: "allowed" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ decision: "allowed", grantId: "g_12345678", curl: expect.stringContaining(`https://b.test/request -H 'content-type: application/json' -d '{"amount":"$12.50","payee":"api.stripe.com","intent":"playground"}'`) });
  });
  it("maps every preset to its decision", async () => {
    expect((await request(deps, "ip", { preset: "held" })).body).toMatchObject({ decision: "needs_approval", pendingId: "p_12345678" });
    expect((await request(deps, "ip", { preset: "over-cap" })).body).toMatchObject({ decision: "denied", explain: { rule: "per-action-cap" } });
    expect((await request(deps, "ip", { preset: "off-list" })).body).toMatchObject({ decision: "denied", explain: { rule: "allowlist-miss" } });
  });
  it("refuses anything that is not a preset name", async () => {
    expect(await request(deps, "ip", { preset: "pay-everything" })).toEqual({ status: 400, body: { error: "unknown preset" } });
    expect(await request(deps, "ip", { amount: "$9999" })).toEqual({ status: 400, body: { error: "unknown preset" } });
    expect(await request(deps, "ip", null)).toEqual({ status: 400, body: { error: "unknown preset" } });
  });
  it("rate limits after thirty counted calls from one visitor", async () => {
    for (let i = 0; i < SPEND_LIMIT; i++) expect((await request(deps, "1.1.1.1", { preset: "over-cap" })).status).toBe(200);
    const r = await request(deps, "1.1.1.1", { preset: "over-cap" });
    expect(r.status).toBe(429);
    expect(r.body).toMatchObject({ error: "Thirty spends per ten minutes per visitor.", retryAfterSec: 600 });
    expect((await request(deps, "2.2.2.2", { preset: "over-cap" })).status).toBe(200);
  });
  it("answers 502 when the broker is down", async () => {
    const down = { ...deps, fetch: fakeFetch(() => { throw new TypeError("fetch failed"); }) };
    expect(await request(down, "ip", { preset: "allowed" })).toEqual({ status: 502, body: { error: "playground broker unreachable" } });
  });
});

describe("execute and status", () => {
  it("executes a grant and returns the rail receipt with a curl", async () => {
    const r = await execute(deps, "ip", { grantId: "g_12345678" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "paid", receipt: { paidAmount: { amount: 1250 } }, curl: expect.stringContaining(`-d '{"grantId":"g_12345678"}'`) });
  });
  it("guards the ids", async () => {
    expect(await execute(deps, "ip", { grantId: "x" })).toEqual({ status: 400, body: { error: "grantId is not an id" } });
    expect(await status(deps, "ip", { pendingId: "has space" })).toEqual({ status: 400, body: { error: "pendingId is not an id" } });
  });
  it("execute shares the spend bucket, status has its own", async () => {
    for (let i = 0; i < SPEND_LIMIT; i++) await request(deps, "3.3.3.3", { preset: "over-cap" });
    expect((await execute(deps, "3.3.3.3", { grantId: "g_12345678" })).status).toBe(429);
    expect((await status(deps, "3.3.3.3", { pendingId: "p_12345678" })).status).toBe(200);
  });
});

describe("reads", () => {
  it("chain returns the newest 25 with positions, newest first, cached five seconds", async () => {
    const r = await chain(deps);
    expect(r.status).toBe(200);
    expect(r.cacheSec).toBe(5);
    const b = r.body as { total: number; head: { seq: number }; records: { seq: number; id: string }[] };
    expect(b.total).toBe(30);
    expect(b.records).toHaveLength(25);
    expect(b.records[0]).toMatchObject({ seq: 29, id: "id-29" });
    expect(b.records[24]).toMatchObject({ seq: 5, id: "id-5" });
  });
  it("anchor returns head, last anchor, verify, both keys and a complete command", async () => {
    const r = await anchor(deps);
    expect(r.cacheSec).toBe(15);
    expect(r.body).toEqual({
      stream: "playground", total: 30, head: { seq: 29, hash: HASH },
      lastAnchor: { seq: 27, head: HASH, at: "2026-09-11T00:05:00.000Z", logIndex: "101844748", logUrl: "https://log2025-1.rekor.sigstore.dev", logHost: "log2025-1.rekor.sigstore.dev" },
      verify: { ok: true, coveredUpTo: 27, reason: null },
      witnessKey: "WITKEY", logKey: "log2025-1.rekor.sigstore.dev=LOGKEY",
      verifyCommand: `curl -s "https://b.test:8082/chain?format=jsonl&limit=500" > chain.jsonl\nnpx receipt-verify chain.jsonl --anchors https://b.test:8082 --log-key log2025-1.rekor.sigstore.dev=LOGKEY --witness-key WITKEY --stream playground`,
    });
  });
  it("anchor survives a witness that is down", async () => {
    const down = { ...deps, fetch: fakeFetch(() => { throw new TypeError("fetch failed"); }) };
    expect(await anchor(down)).toEqual({ status: 502, body: { error: "witness unreachable" } });
  });
  it("anchor tolerates a malformed anchor element and reports no anchor", async () => {
    const odd = { ...deps, fetch: fakeFetch((url, body) => (url.includes("/anchors") ? json({ stream: "playground", anchors: [{ seq: 3 }] }) : broker(url, body))) };
    const r = await anchor(odd);
    expect(r.status).toBe(200);
    expect((r.body as { lastAnchor: unknown }).lastAnchor).toBeNull();
  });
  it("anchor answers 502 when the witness answers an error status", async () => {
    const sick = { ...deps, fetch: fakeFetch((url, body) => (url.endsWith("/verify") ? json({ error: "boom" }, 500) : broker(url, body))) };
    expect(await anchor(sick)).toEqual({ status: 502, body: { error: "witness unreachable" } });
  });
  it("flags reads the designated project, cached three seconds", async () => {
    const r = await flags(deps);
    expect(r.status).toBe(200);
    expect(r.cacheSec).toBe(3);
    expect(r.body).toMatchObject({ monitor: { state: "never" }, flags: [] });
  });
  it("flags answers 502 when the database read fails", async () => {
    const broken = { ...deps, db: { select() { throw new Error("db down"); } } as unknown as Db };
    expect(await flags(broken)).toEqual({ status: 502, body: { error: "flags unavailable" } });
  });
  it("chain against an empty stream returns no head and no records", async () => {
    const empty = { ...deps, fetch: fakeFetch((url) => (url.includes("/chain") ? json({ stream: "playground", total: 0, head: null, since: 0, count: 0, records: [] }) : json({ error: "not found" }, 404))) };
    const r = await chain(empty);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 0, head: null, records: [] });
  });
  it("anchor gives a plain verify-command message when the witness has not published a key", async () => {
    const noKey = { ...deps, fetch: fakeFetch((url, body) => (url.endsWith(":8082/") ? json({ stream: "playground", witness: {}, log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "kid" } }) : broker(url, body))) };
    const r = await anchor(noKey);
    expect(r.status).toBe(200);
    const b = r.body as { witnessKey: string; verifyCommand: string };
    expect(b.witnessKey).toBe("");
    expect(b.verifyCommand).toBe("The witness did not publish its key, so the verify command cannot be completed.");
  });
});
