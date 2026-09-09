import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
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
    await maybeAlert(db, resendMailer(), ownerEmail, r.projectId, r.newIds, new Date(), origin).catch(() => undefined);
  }
  return NextResponse.json(r.body, { status: r.status });
}
