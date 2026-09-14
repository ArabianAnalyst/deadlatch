import { describe, it, expect } from "vitest";
import type { Db } from "@/lib/db/types";
import { homeProof, fmtInt, minutesAgo } from "@/lib/home/proof";

type Route = (url: string) => Response | never;
const fakeFetch = (route: Route): typeof fetch => (async (input: RequestInfo | URL) => route(String(input))) as typeof fetch;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const ANCHOR = { v: 1, stream: "playground", seq: 27, head: "a".repeat(64), at: "2026-09-14T10:00:00.000Z", witness: { alg: "ecdsa-p256", publicKey: "WK" }, signature: "s", log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "k" }, entry: { logIndex: "105663672", canonicalizedBody: "x" }, proof: {} };
function witness(url: string): Response {
  if (url.endsWith(":8082/")) return json({ stream: "playground", witness: { publicKey: "WK" }, log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "k" } });
  if (url.includes("/chain")) return json({ stream: "playground", total: 1204, head: { seq: 1203, hash: "b".repeat(64) }, since: 1203, count: 1, next: null, records: [] });
  if (url.includes("/anchors")) return json({ stream: "playground", anchors: [ANCHOR] });
  if (url.endsWith("/verify")) return json({ ok: true, coveredUpTo: 27, anchors: [], chain: { ok: true }, stream: "playground" });
  return json({ error: "not found" }, 404);
}
const env = { brokerUrl: "https://b.test", witnessUrl: "https://b.test:8082", projectId: "p", logKey: "log2025-1.rekor.sigstore.dev=LK" };
const db = {} as unknown as Db;

describe("homeProof", () => {
  it("maps the anchor read to the three numbers the band shows", async () => {
    const p = await homeProof({ db, fetch: fakeFetch(witness), env });
    expect(p).toEqual({ total: 1204, lastAnchor: { seq: 27, logIndex: "105663672", at: "2026-09-14T10:00:00.000Z", logHost: "log2025-1.rekor.sigstore.dev" } });
  });
  it("keeps the total when there is no anchor yet", async () => {
    const f = fakeFetch((u) => (u.includes("/anchors") ? json({ stream: "playground", anchors: [] }) : witness(u)));
    expect(await homeProof({ db, fetch: f, env })).toEqual({ total: 1204, lastAnchor: null });
  });
  it("is null when the environment is missing", async () => {
    expect(await homeProof({ db, fetch: fakeFetch(witness), env: null })).toBeNull();
  });
  it("is null when the witness is down or answers nonsense", async () => {
    expect(await homeProof({ db, fetch: fakeFetch(() => { throw new TypeError("fetch failed"); }), env })).toBeNull();
    const bad = fakeFetch((u) => (u.includes("/chain") ? json({ stream: "playground" }) : witness(u)));
    expect(await homeProof({ db, fetch: bad, env })).toBeNull();
  });
});

describe("formatting", () => {
  it("formats integers and ages the way the band reads them", () => {
    expect(fmtInt(1204)).toBe("1,204");
    expect(fmtInt(7)).toBe("7");
    const now = new Date("2026-09-14T10:30:00.000Z");
    expect(minutesAgo("2026-09-14T10:29:40.000Z", now)).toBe("under a minute ago");
    expect(minutesAgo("2026-09-14T10:26:00.000Z", now)).toBe("4 min ago");
    expect(minutesAgo("2026-09-14T09:30:00.000Z", now)).toBe("1 hour ago");
    expect(minutesAgo("2026-09-14T07:00:00.000Z", now)).toBe("4 hours ago");
    expect(minutesAgo("2026-09-14T11:00:00.000Z", now)).toBe("under a minute ago");
    expect(minutesAgo("2026-09-13T10:00:00.000Z", now)).toBe("1 day ago");
    expect(minutesAgo("2026-09-11T21:00:00.000Z", now)).toBe("2 days ago");
  });
});
