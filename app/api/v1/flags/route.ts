import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { ingestFlags } from "@/lib/watch/ingest";

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
  return NextResponse.json(r.body, { status: r.status });
}
