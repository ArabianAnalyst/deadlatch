import Link from "next/link";
import type { HomeProof } from "@/lib/home/proof";
import { fmtInt, minutesAgo } from "@/lib/home/format";

/**
 * Every anchor on the playground chain carried three cosigning witnesses when the verifier ran on 2026-09-11.
 * A constant rather than a read, because proving it means running the verifier and that is not worth doing per request.
 */
export const COSIGNERS = 3;

export default function ProofBand({ proof }: { proof: HomeProof | null }) {
  if (!proof) return null;
  const a = proof.lastAnchor;
  return (
    <section className="wrap proof" aria-label="Live proof from the playground chain">
      <div className="proof-grid">
        <div className="proof-cell">
          <div className="proof-n">{fmtInt(proof.total)}</div>
          <div className="proof-l">receipts on the playground chain</div>
        </div>
        <div className="proof-cell">
          {a ? (
            <>
              <div className="proof-n">seq {fmtInt(a.seq)}</div>
              <div className="proof-l">
                anchored in {a.logHost || "a public transparency log"} · entry {a.logIndex} · {minutesAgo(a.at)}
              </div>
            </>
          ) : (
            <>
              <div className="proof-n">first anchor pending</div>
              <div className="proof-l">anchored within five minutes of the next receipt</div>
            </>
          )}
        </div>
        <div className="proof-cell">
          <div className="proof-n">{COSIGNERS} witnesses</div>
          <div className="proof-l">cosign every anchor, none of them ours</div>
        </div>
      </div>
      <p className="proof-line">
        Press a button, a real broker decides, and you get a receipt like this. No sign-up.{" "}
        <Link href="/try">Try it live ↗</Link>
      </p>
    </section>
  );
}
