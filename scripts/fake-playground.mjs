// A local stand-in for the playground broker and its witness, on one port. Decisions follow the playground policy,
// receipts are chained with the real canonical form, anchors are pretend. Run: node scripts/fake-playground.mjs 8790
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const port = Number(process.argv[2] ?? 8790);
const GENESIS = "0".repeat(64);
const chain = [];
const grants = new Map();
const sha = (s) => createHash("sha256").update(s).digest("hex");
function append(kind, payload) {
  const prevHash = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const r = { id: randomUUID(), ts: new Date().toISOString(), kind, payload, prevHash };
  r.hash = sha(JSON.stringify({ id: r.id, ts: r.ts, kind: r.kind, payload: r.payload, prevHash: r.prevHash }));
  chain.push(r);
  return r;
}
const cents = (s) => Math.round(Number(String(s).replace(/[^0-9.]/g, "")) * 100);
function decide(b) {
  const amount = { amount: cents(b.amount), currency: "USD" };
  const request = { amount, payee: b.payee, intent: b.intent };
  if (b.payee !== "api.stripe.com") { append("decision", { request, status: "denied", reason: `denied: payee "${b.payee}" is not on the allowlist`, policyVersion: "fake" }); return { decision: "denied", reason: `denied: payee "${b.payee}" is not on the allowlist`, explain: { rule: "allowlist-miss", policyVersion: "fake", evaluated: request } }; }
  if (amount.amount > 5000) { append("decision", { request, status: "denied", reason: "denied: exceeds the per-action cap of 50.00 USD", policyVersion: "fake" }); return { decision: "denied", reason: `denied: ${(amount.amount / 100).toFixed(2)} USD exceeds the per-action cap of 50.00 USD`, explain: { rule: "per-action-cap", policyVersion: "fake", evaluated: request } }; }
  if (amount.amount > 2000) { const pendingId = "p_" + randomUUID().replace(/-/g, "").slice(0, 16); append("decision", { request, status: "needs_approval", reason: "held for approval", policyVersion: "fake" }); return { decision: "needs_approval", pendingId, reason: "held: above the approval line of 20.00 USD", explain: { rule: "require-approval", policyVersion: "fake", evaluated: request } }; }
  const grantId = "g_" + randomUUID().replace(/-/g, "").slice(0, 16);
  grants.set(grantId, request);
  append("decision", { request, status: "allowed", reason: "within policy", policyVersion: "fake", grantId });
  return { decision: "allowed", grantId, reason: "within policy", explain: { rule: "within-policy", policyVersion: "fake", evaluated: request } };
}
function execute(grantId) {
  const req = grants.get(grantId);
  if (!req) return { status: "rejected", reason: "unknown or spent grant" };
  grants.delete(grantId);
  const receipt = { ok: true, ref: "mock-" + randomUUID().slice(0, 8), paidAmount: req.amount };
  append("decision", { request: req, status: "allowed", reason: "executed", policyVersion: "fake", event: "executed", grantId, receipt });
  return { status: "paid", reason: "executed", receipt };
}
const json = (res, status, body) => { const t = JSON.stringify(body); res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(t) }); res.end(t); };
createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://x`);
  let body = {};
  if (req.method === "POST") { let t = ""; for await (const c of req) t += c; try { body = JSON.parse(t || "{}"); } catch { return json(res, 400, { error: "bad json" }); } }
  if (req.method === "POST" && url.pathname === "/request") return json(res, 200, decide(body));
  if (req.method === "POST" && url.pathname === "/execute") return json(res, 200, execute(String(body.grantId ?? "")));
  if (req.method === "POST" && url.pathname === "/status") return json(res, 200, { state: "pending" });
  if (url.pathname === "/healthz") return json(res, 200, { ok: true });
  if (url.pathname === "/") return json(res, 200, { service: "fake-playground", stream: "playground", witness: { alg: "ecdsa-p256", publicKey: "FAKEWITNESSKEY" }, log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "fake" } });
  if (url.pathname === "/chain") {
    const since = Math.max(0, Number(url.searchParams.get("since") ?? 0)); const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
    const records = chain.slice(since, since + limit); const head = chain.length ? { seq: chain.length - 1, hash: chain[chain.length - 1].hash } : null;
    if (url.searchParams.get("format") === "jsonl") { const t = records.map((r) => JSON.stringify(r) + "\n").join(""); res.writeHead(200, { "content-type": "application/x-ndjson" }); return res.end(t); }
    return json(res, 200, { stream: "playground", total: chain.length, head, since: Math.min(since, chain.length), count: records.length, records });
  }
  if (url.pathname === "/anchors") { void url.searchParams.get("tail"); /* real witness's tail=<n>, this fake only ever has 0 or 1 anchors so any value is honoured trivially */ const n = chain.length; const seq = Math.max(0, n - 1 - (n % 3)); return json(res, 200, { stream: "playground", anchors: n ? [{ v: 1, stream: "playground", seq, head: chain[seq].hash, at: new Date(Date.now() - 120000).toISOString(), witness: { alg: "ecdsa-p256", publicKey: "FAKEWITNESSKEY" }, signature: "fake", log: { url: "https://log2025-1.rekor.sigstore.dev", keyId: "fake" }, entry: { logIndex: "101844748", canonicalizedBody: "fake" }, proof: {} }] : [] }); }
  if (url.pathname === "/verify") { const n = chain.length; return json(res, 200, { ok: true, coveredUpTo: n ? Math.max(0, n - 1 - (n % 3)) : null, anchors: [], chain: { ok: true }, stream: "playground" }); }
  return json(res, 404, { error: "not found" });
}).listen(port, "127.0.0.1", () => console.log(`fake playground on http://127.0.0.1:${port}`));
