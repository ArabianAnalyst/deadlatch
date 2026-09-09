import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { flagFor, projectFor } from "@/lib/watch/queries";
import Acknowledge from "@/components/app/Acknowledge";

export const metadata: Metadata = { title: "Flag — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FlagPage({ params }: { params: Promise<{ project: string; id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const { project: pid, id } = await params;
  const project = await projectFor(db, userId, pid);
  if (!project) notFound();
  const flag = await flagFor(db, project.id, id);
  if (!flag) notFound();
  const ref = flag.ref as { stream: string; seq: number; id: string; hash: string; ts: string };
  const offender = flag.offender as { action: string; outcome?: string; input?: unknown };
  const window = flag.window as { fromSeq: number; toSeq: number; count: number; matched: Array<{ seq: number; hash: string; ts: string }> };
  return (
    <main className="wrap logwrap app">
      <Link href={`/app/${project.id}`} className="log-back mono">← {project.name}</Link>
      <header className="log-hd">
        <div className="eyebrow">{flag.expectationId}</div>
        <h1>{flag.reason}</h1>
        <p className="mono app-muted">flag {flag.id.slice(0, 12)} · raised {flag.at.toISOString()} · received {flag.receivedAt.toISOString()}</p>
      </header>
      <section className="app-card">
        <div className="eyebrow">The offending record</div>
        <p className="mono">{offender.action}{offender.outcome ? ` → ${offender.outcome}` : ""}</p>
        <pre className="mono app-pre">{JSON.stringify(offender.input ?? flag.cause, null, 2)}</pre>
      </section>
      <section className="app-card">
        <div className="eyebrow">The receipt</div>
        <dl className="app-dl">
          <dt>stream</dt><dd className="mono">{ref.stream}</dd>
          <dt>seq</dt><dd className="mono">{ref.seq}</dd>
          <dt>id</dt><dd className="mono">{ref.id}</dd>
          <dt>hash</dt><dd className="mono app-hash">{ref.hash}</dd>
          <dt>ts</dt><dd className="mono">{ref.ts}</dd>
        </dl>
      </section>
      <section className="app-card">
        <div className="eyebrow">The window that tripped it</div>
        <p className="mono app-muted">seq {window.fromSeq} to {window.toSeq}, {window.count} records, {window.matched.length} matched this rule</p>
        {window.matched.length > 0 ? (
          <ul className="app-list mono">{window.matched.map((m) => <li key={m.seq}>seq {m.seq} · {m.hash.slice(0, 8)} · {m.ts}</li>)}</ul>
        ) : null}
      </section>
      <section className="app-card">
        <div className="eyebrow">Verify it yourself</div>
        <p>Export the chain from the broker's admin port and the anchors from its witness, then run the verifier with the two public keys. The flag points at seq {ref.seq}.</p>
        <pre className="mono app-pre">{`npx -p @olurabian/receipt receipt-verify chain.json --anchors anchors.json --log-key <origin>=<base64> --witness-key <base64> --stream ${ref.stream}`}</pre>
      </section>
      <Acknowledge projectId={project.id} flagId={flag.id} acknowledgedAt={flag.acknowledgedAt} />
    </main>
  );
}
