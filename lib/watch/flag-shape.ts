/** The wire shape of a flag, as @olurabian/tripwire/monitor emits it. Checked field by field; the first wrong field is named. */
export interface WireRef { stream: string; seq: number; id: string; hash: string; ts: string }
export interface WireFlag {
  v: 1;
  id: string;
  expectation: { id: string; reason: string };
  offender: { action: string; ref: WireRef; [k: string]: unknown };
  cause: unknown;
  window: { fromSeq: number; toSeq: number; count: number; matched: WireRef[] };
  at: string;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isIso = (x: unknown): x is string => isStr(x) && !Number.isNaN(Date.parse(x));

function badRef(r: unknown): string | null {
  if (!isObj(r)) return "";
  if (!isStr(r.stream)) return "stream";
  if (!isNum(r.seq)) return "seq";
  if (!isStr(r.id)) return "id";
  if (!isStr(r.hash)) return "hash";
  if (!isIso(r.ts)) return "ts";
  return null;
}

/** Null when the value is a well-formed flag, otherwise the first failing field as a dotted path ("" for a non-object). */
export function validateFlag(x: unknown): { field: string } | null {
  if (!isObj(x)) return { field: "" };
  if (x.v !== 1) return { field: "v" };
  if (!isStr(x.id) || !/^[0-9a-f]{64}$/.test(x.id)) return { field: "id" };
  if (!isObj(x.expectation)) return { field: "expectation" };
  if (!isStr(x.expectation.id)) return { field: "expectation.id" };
  if (!isStr(x.expectation.reason)) return { field: "expectation.reason" };
  if (!isObj(x.offender)) return { field: "offender" };
  if (!isStr(x.offender.action)) return { field: "offender.action" };
  const refField = badRef(x.offender.ref);
  if (refField !== null) return { field: refField ? `offender.ref.${refField}` : "offender.ref" };
  if (!isObj(x.window)) return { field: "window" };
  if (!isNum(x.window.fromSeq)) return { field: "window.fromSeq" };
  if (!isNum(x.window.toSeq)) return { field: "window.toSeq" };
  if (!isNum(x.window.count)) return { field: "window.count" };
  if (!Array.isArray(x.window.matched)) return { field: "window.matched" };
  for (const [i, m] of x.window.matched.entries()) {
    const f = badRef(m);
    if (f !== null) return { field: f ? `window.matched.${i}.${f}` : `window.matched.${i}` };
  }
  if (!isIso(x.at)) return { field: "at" };
  return null;
}
