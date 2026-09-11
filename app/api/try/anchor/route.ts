import { db } from "@/lib/db/client";
import { anchor } from "@/lib/try/handlers";
import { envFromProcess, reply, notConfigured } from "@/lib/try/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = envFromProcess();
  if (!env) return notConfigured();
  return reply(await anchor({ db, fetch, env }));
}
