import { db } from "@/lib/db/client";
import { status } from "@/lib/try/handlers";
import { envFromProcess, ipFrom, reply, notConfigured } from "@/lib/try/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const env = envFromProcess();
  if (!env) return notConfigured();
  const body = await req.json().catch(() => null);
  return reply(await status({ db, fetch, env }, ipFrom(req.headers), body));
}
