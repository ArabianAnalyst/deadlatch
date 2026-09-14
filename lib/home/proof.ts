import type { Db } from "@/lib/db/types";
import { anchor, type TryEnv } from "@/lib/try/handlers";
import { envFromProcess } from "@/lib/try/env";

export interface HomeProof {
  total: number;
  lastAnchor: { seq: number; logIndex: string; at: string; logHost: string } | null;
}

interface AnchorBody {
  total?: unknown;
  lastAnchor?: { seq?: unknown; logIndex?: unknown; at?: unknown; logHost?: unknown } | null;
}

export interface HomeProofDeps {
  db: Db;
  fetch: typeof fetch;
  /** Omit to read the process environment. Pass null to simulate an unconfigured deployment. */
  env?: TryEnv | null;
}

/**
 * The numbers the homepage band shows, read through the same anchor handler the playground uses, or null when
 * there is nothing honest to show. A missing environment, an unreachable witness, or a malformed answer all give
 * null, and the band renders nothing for null. It never shows a placeholder number.
 */
export async function homeProof(deps: HomeProofDeps): Promise<HomeProof | null> {
  const env = deps.env === undefined ? envFromProcess() : deps.env;
  if (!env) return null;
  try {
    const r = await anchor({ db: deps.db, fetch: deps.fetch, env });
    if (r.status !== 200) return null;
    const b = r.body as AnchorBody;
    if (typeof b.total !== "number") return null;
    const la = b.lastAnchor;
    const lastAnchor =
      la && typeof la.seq === "number" && typeof la.logIndex === "string" && typeof la.at === "string"
        ? { seq: la.seq, logIndex: la.logIndex, at: la.at, logHost: typeof la.logHost === "string" ? la.logHost : "" }
        : null;
    return { total: b.total, lastAnchor };
  } catch {
    return null;
  }
}

export { fmtInt, minutesAgo } from "./format";
