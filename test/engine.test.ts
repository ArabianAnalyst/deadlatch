import { describe, it, expect } from "vitest";
import { appendRecord, verifyAppended, verifyChain, type ChainEntry } from "@/lib/engine";

describe("verifyAppended", () => {
  it("accepts genuine appends and rejects a tampered or mislinked entry, agreeing with verifyChain", async () => {
    const chain: ChainEntry[] = [];
    const a = await appendRecord(chain, { amountCents: 1200, payee: "api.stripe.com", verdict: "allow" });
    chain.push(a);
    const b = await appendRecord(chain, { amountCents: 420, payee: "s3.aws.amazon.com", verdict: "allow" });

    expect(await verifyAppended(undefined, a)).toBe(true);
    expect(await verifyAppended(a, b)).toBe(true);
    expect((await verifyChain([a, b])).ok).toBe(true);

    const tampered = { ...b, record: { ...b.record, amountCents: 99900 } };
    expect(await verifyAppended(a, tampered)).toBe(false);
    expect((await verifyChain([a, tampered])).ok).toBe(false);

    const mislinked = { ...b, prev: "1".repeat(64) };
    expect(await verifyAppended(a, mislinked)).toBe(false);

    const firstWithWrongGenesis = { ...a, prev: "1".repeat(64) };
    expect(await verifyAppended(undefined, firstWithWrongGenesis)).toBe(false);
  });
});
