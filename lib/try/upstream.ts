export const TIMEOUT_MS = 10_000;

/** What the page says when the broker or the witness cannot be reached or answers nonsense. */
export class UpstreamError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, public readonly which: "broker" | "witness") {
    super(typeof (body as { error?: unknown })?.error === "string" ? String((body as { error: string }).error) : "upstream error");
  }
}

const DOWN = { broker: { error: "playground broker unreachable" }, witness: { error: "witness unreachable" } } as const;

async function call(fetchImpl: typeof fetch, which: "broker" | "witness", url: string, init: RequestInit): Promise<{ status: number; json: unknown }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: ctl.signal });
  } catch {
    throw new UpstreamError(502, DOWN[which], which);
  } finally {
    clearTimeout(timer);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError(502, DOWN[which], which);
  }
  return { status: res.status, json };
}

const base = (u: string) => u.replace(/\/+$/, "");

/** POST a JSON body to the broker's agent port. Upstream statuses are returned as-is; only unreachability throws. */
export function brokerPost(fetchImpl: typeof fetch, brokerUrl: string, path: "/request" | "/execute" | "/status", body: object) {
  return call(fetchImpl, "broker", `${base(brokerUrl)}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** GET a JSON document from the witness port. */
export function witnessGet(fetchImpl: typeof fetch, witnessUrl: string, pathWithQuery: string) {
  return call(fetchImpl, "witness", `${base(witnessUrl)}${pathWithQuery}`, { method: "GET" });
}
