import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { monitors } from "@/lib/db/schema";
import { ingestFlags } from "@/lib/watch/ingest";
import { maybeAlert } from "@/lib/watch/alert";
import { resendMailer } from "@/lib/watch/mailer";
import { ownerEmail } from "@/lib/watch/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const text = await req.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 422 });
  }
  const r = await ingestFlags(db, req.headers.get("authorization"), raw, Buffer.byteLength(text, "utf8"));
  if (r.status === 202 && r.projectId && r.newIds && r.newIds.length > 0) {
    const origin = process.env.APP_ORIGIN ?? "https://www.deadlatch.dev";
    const projectId = r.projectId;
    try {
      const a = await maybeAlert(db, resendMailer(), ownerEmail, projectId, r.newIds, new Date(), origin);
      if (a.sent) await db.update(monitors).set({ lastAlertAt: new Date(), lastAlertError: null }).where(eq(monitors.projectId, projectId));
      else if (a.error) await db.update(monitors).set({ lastAlertError: a.error }).where(eq(monitors.projectId, projectId));
    } catch (e) {
      console.error("deadlatch alert hook failed", { projectId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json(r.body, { status: r.status });
}
