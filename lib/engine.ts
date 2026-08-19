// The real logic behind the live console. A small policy engine that decides
// allow / hold / deny at the moment of action, and a genuine SHA-256 hash chain
// that proves the record was not edited. No mockups.

export type Verdict = "allow" | "hold" | "deny";

export interface Action {
  amountCents: number;
  payee: string;
}

export interface Decision {
  verdict: Verdict;
  reason: string;
}

export interface Policy {
  maxPerActionCents: number;
  maxPerDayCents: number;
  approveOverCents: number;
  allow: string[]; // exact host, or "*.suffix" wildcard
}

export const POLICY: Policy = {
  maxPerActionCents: 10000, // $100.00
  maxPerDayCents: 20000, // $200.00
  approveOverCents: 5000, // $50.00
  allow: ["api.stripe.com", "*.aws.amazon.com"],
};

export function payeeAllowed(payee: string, policy: Policy = POLICY): boolean {
  return policy.allow.some((rule) =>
    rule.startsWith("*.") ? payee.endsWith(rule.slice(1)) : payee === rule,
  );
}

// Enforcement order mirrors Purse: allowlist, per-action cap, daily cap
// (fail closed), then approval threshold, else allow.
export function evaluate(
  action: Action,
  spentTodayCents: number,
  policy: Policy = POLICY,
): Decision {
  if (!payeeAllowed(action.payee, policy)) {
    return { verdict: "deny", reason: "payee off allowlist" };
  }
  if (action.amountCents > policy.maxPerActionCents) {
    return { verdict: "deny", reason: "over per-action cap" };
  }
  if (spentTodayCents + action.amountCents > policy.maxPerDayCents) {
    return { verdict: "deny", reason: "over daily cap, fail closed" };
  }
  if (action.amountCents > policy.approveOverCents) {
    return { verdict: "hold", reason: "needs human approval" };
  }
  return { verdict: "allow", reason: "within policy" };
}

export function formatUsd(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

// ---- blackbox-style tamper-evident hash chain (real SHA-256) ----

export interface ChainRecord {
  amountCents: number;
  payee: string;
  verdict: Verdict;
}

export interface ChainEntry {
  seq: number;
  record: ChainRecord;
  prev: string;
  hash: string;
}

const GENESIS = "0".repeat(64);

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function appendRecord(
  chain: ChainEntry[],
  record: ChainRecord,
): Promise<ChainEntry> {
  const prev = chain.length ? chain[chain.length - 1]!.hash : GENESIS;
  const hash = await sha256(prev + JSON.stringify(record));
  return { seq: chain.length + 1, record, prev, hash };
}

export interface VerifyResult {
  ok: boolean;
  brokenAt?: number;
}

export async function verifyChain(chain: ChainEntry[]): Promise<VerifyResult> {
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]!;
    const prev = i ? chain[i - 1]!.hash : GENESIS;
    const hash = await sha256(prev + JSON.stringify(entry.record));
    if (hash !== entry.hash || entry.prev !== prev) {
      return { ok: false, brokenAt: i + 1 };
    }
  }
  return { ok: true };
}
