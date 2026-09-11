import type { Db } from "@/lib/db/types";
import { PRESETS, isPreset, isId, curlFor } from "./presets";
import { take, keyFor, SPEND_LIMIT, STATUS_LIMIT } from "./limiter";
import { brokerPost, witnessGet, UpstreamError } from "./upstream";
import { publicWatch } from "./public";
import type { TryEnv } from "./env";

export type { TryEnv };
export interface TryDeps { db: Db; fetch: typeof fetch; env: TryEnv; now?: () => Date }
export interface Reply { status: number; body: unknown; cacheSec?: number }

const LIMITED = "Thirty spends per ten minutes per visitor.";
const TAIL = 25;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isAnchor = (x: unknown): x is AnchorDoc =>
  isObj(x) && typeof x.seq === "number" && typeof x.head === "string" && typeof x.at === "string"
  && isObj(x.entry) && typeof x.entry.logIndex === "string" && isObj(x.log) && typeof x.log.url === "string";

function fail(e: unknown): Reply {
  if (e instanceof UpstreamError) return { status: e.status, body: e.body };
  throw e;
}

async function limited(deps: TryDeps, ip: string, bucket: "" | ":status", limit: number): Promise<Reply | null> {
  const t = await take(deps.db, keyFor(ip) + bucket, limit, deps.now?.());
  return t.ok ? null : { status: 429, body: { error: LIMITED, retryAfterSec: t.retryAfterSec } };
}

/** A preset name in, the broker's decision out, with the curl that does the same thing. */
export async function request(deps: TryDeps, ip: string, body: unknown): Promise<Reply> {
  const preset = isObj(body) ? body.preset : undefined;
  if (!isPreset(preset)) return { status: 400, body: { error: "unknown preset" } };
  const over = await limited(deps, ip, "", SPEND_LIMIT);
  if (over) return over;
  const sent = PRESETS[preset];
  try {
    const r = await brokerPost(deps.fetch, deps.env.brokerUrl, "/request", sent);
    const out = isObj(r.json) ? { ...r.json, curl: curlFor(deps.env.brokerUrl, "/request", sent) } : r.json;
    return { status: r.status, body: out };
  } catch (e) { return fail(e); }
}

export async function execute(deps: TryDeps, ip: string, body: unknown): Promise<Reply> {
  const grantId = isObj(body) ? body.grantId : undefined;
  if (!isId(grantId)) return { status: 400, body: { error: "grantId is not an id" } };
  const over = await limited(deps, ip, "", SPEND_LIMIT);
  if (over) return over;
  try {
    const r = await brokerPost(deps.fetch, deps.env.brokerUrl, "/execute", { grantId });
    const out = isObj(r.json) ? { ...r.json, curl: curlFor(deps.env.brokerUrl, "/execute", { grantId }) } : r.json;
    return { status: r.status, body: out };
  } catch (e) { return fail(e); }
}

export async function status(deps: TryDeps, ip: string, body: unknown): Promise<Reply> {
  const pendingId = isObj(body) ? body.pendingId : undefined;
  if (!isId(pendingId)) return { status: 400, body: { error: "pendingId is not an id" } };
  const over = await limited(deps, ip, ":status", STATUS_LIMIT);
  if (over) return over;
  try {
    const r = await brokerPost(deps.fetch, deps.env.brokerUrl, "/status", { pendingId });
    const out = isObj(r.json) ? { ...r.json, curl: curlFor(deps.env.brokerUrl, "/status", { pendingId }) } : r.json;
    return { status: r.status, body: out };
  } catch (e) { return fail(e); }
}

interface ChainDoc { stream: string; total: number; head: { seq: number; hash: string } | null; since: number; count: number; records: Record<string, unknown>[] }

async function tail(deps: TryDeps): Promise<ChainDoc> {
  const first = await witnessGet(deps.fetch, deps.env.witnessUrl, `/chain?since=0&limit=1`);
  if (first.status !== 200 || !isObj(first.json)) throw new UpstreamError(502, { error: "witness unreachable" }, "witness");
  const total = typeof first.json.total === "number" ? first.json.total : 0;
  const since = Math.max(0, total - TAIL);
  const r = await witnessGet(deps.fetch, deps.env.witnessUrl, `/chain?since=${since}&limit=${TAIL}`);
  if (r.status !== 200 || !isObj(r.json)) throw new UpstreamError(502, { error: "witness unreachable" }, "witness");
  return r.json as unknown as ChainDoc;
}

/** The newest 25 envelopes, newest first, each with its 0-based position. */
export async function chain(deps: TryDeps): Promise<Reply> {
  try {
    const c = await tail(deps);
    const records = c.records.map((r, i) => ({ seq: c.since + i, ...r })).reverse();
    return { status: 200, cacheSec: 5, body: { stream: c.stream, total: c.total, head: c.head, records } };
  } catch (e) { return fail(e); }
}

interface AnchorDoc { seq: number; head: string; at: string; log: { url: string }; entry: { logIndex: string } }

/** Head, last anchor, the witness's live verify, both public keys, and the complete sceptic command. */
export async function anchor(deps: TryDeps): Promise<Reply> {
  try {
    const [idx, c, an, v] = await Promise.all([
      witnessGet(deps.fetch, deps.env.witnessUrl, "/"),
      witnessGet(deps.fetch, deps.env.witnessUrl, "/chain?since=0&limit=1"),
      witnessGet(deps.fetch, deps.env.witnessUrl, "/anchors?tail=1"),
      witnessGet(deps.fetch, deps.env.witnessUrl, "/verify"),
    ]);
    for (const r of [idx, c, an, v]) {
      if (r.status !== 200 || !isObj(r.json)) throw new UpstreamError(502, { error: "witness unreachable" }, "witness");
    }
    const index = isObj(idx.json) ? idx.json : {};
    const stream = String(index.stream ?? "playground");
    const witnessKey = isObj(index.witness) ? String(index.witness.publicKey ?? "") : "";
    const doc = isObj(c.json) ? (c.json as unknown as ChainDoc) : { total: 0, head: null };
    const raw = isObj(an.json) && Array.isArray(an.json.anchors) ? an.json.anchors : [];
    const last = raw.length && isAnchor(raw[raw.length - 1]) ? (raw[raw.length - 1] as AnchorDoc) : null;
    let logHost: string | null = null;
    if (last) { try { logHost = new URL(last.log.url).host; } catch { logHost = null; } }
    const verify = isObj(v.json) ? v.json : {};
    const chainRes = isObj(verify.chain) ? verify.chain : {};
    const base = deps.env.witnessUrl.replace(/\/+$/, "");
    const verifyCommand = witnessKey
      ? `curl -s "${base}/chain?format=jsonl&limit=500" > chain.jsonl\nnpx receipt-verify chain.jsonl --anchors ${base} --log-key ${deps.env.logKey} --witness-key ${witnessKey} --stream ${stream}`
      : "The witness did not publish its key, so the verify command cannot be completed.";
    return {
      status: 200, cacheSec: 15,
      body: {
        stream, total: doc.total, head: doc.head,
        lastAnchor: last ? { seq: last.seq, head: last.head, at: last.at, logIndex: last.entry.logIndex, logUrl: last.log.url, logHost } : null,
        verify: { ok: verify.ok === true, coveredUpTo: typeof verify.coveredUpTo === "number" ? verify.coveredUpTo : null, reason: typeof chainRes.reason === "string" ? chainRes.reason : null },
        witnessKey, logKey: deps.env.logKey, verifyCommand,
      },
    };
  } catch (e) { return fail(e); }
}

export async function flags(deps: TryDeps): Promise<Reply> {
  try {
    const w = await publicWatch(deps.db, deps.env.projectId, deps.now?.());
    return { status: 200, cacheSec: 3, body: w };
  } catch { return { status: 502, body: { error: "flags unavailable" } }; }
}
