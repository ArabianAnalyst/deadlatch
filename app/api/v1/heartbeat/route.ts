import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { heartbeat } from "@/lib/watch/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 422 });
  }
  const r = await heartbeat(db, req.headers.get("authorization"), raw);
  return r.status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(r.body, { status: r.status });
}
