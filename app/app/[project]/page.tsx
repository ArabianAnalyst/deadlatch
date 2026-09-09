import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { dashboard, projectFor } from "@/lib/watch/queries";

export const metadata: Metadata = { title: "Project — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATE_LABEL = { never: "no heartbeat yet", ok: "monitor alive", amber: "heartbeat late", red: "heartbeat missing" } as const;

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const { project: id } = await params;
  const project = await projectFor(db, userId, id);
  if (!project) notFound();
  const d = await dashboard(db, project.id);
  const expectations = Array.from(new Set([...Object.keys(d.counts.week), ...Object.keys(d.counts.day)])).sort();
  return (
    <main className="wrap logwrap app">
      <Link href="/app" className="log-back mono">← Projects</Link>
      <header className="log-hd">
        <div className="eyebrow">{project.stream}</div>
        <h1>{project.name}</h1>
        <p className="mono app-links"><Link href={`/app/${project.id}/settings`}>settings</Link></p>
      </header>
      <section className="app-card app-status">
        <span className={`app-dot ${d.monitor.state}`} aria-hidden="true" />
        <div>
          <div className="app-status-label">{STATE_LABEL[d.monitor.state]}</div>
          <div className="mono app-muted">
            {d.monitor.version ? `monitor ${d.monitor.version}` : "no monitor has reported"}
            {d.monitor.cursorSeq !== null ? ` · cursor ${d.monitor.cursorSeq}` : ""}
            {d.monitor.lastHeartbeatAt ? ` · last heartbeat ${d.monitor.lastHeartbeatAt.toISOString()}` : ""}
          </div>
        </div>
      </section>
      <section className="app-card">
        <div className="eyebrow">Flags by expectation</div>
        {expectations.length === 0 ? <p className="app-muted">No flags yet. That is the good outcome, not an empty one.</p> : (
          <table className="app-table">
            <thead><tr><th>expectation</th><th>24 hours</th><th>7 days</th></tr></thead>
            <tbody>{expectations.map((e) => <tr key={e}><td className="mono">{e}</td><td className="mono">{d.counts.day[e] ?? 0}</td><td className="mono">{d.counts.week[e] ?? 0}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <section className="app-card">
        <div className="eyebrow">Recent flags</div>
        {d.recent.length === 0 ? <p className="app-muted">Nothing to show.</p> : (
          <table className="app-table">
            <thead><tr><th>expectation</th><th>payee</th><th>amount</th><th>seq</th><th>at</th></tr></thead>
            <tbody>
              {d.recent.map((f) => (
                <tr key={f.id} className={f.acknowledgedAt ? "app-ack" : ""}>
                  <td><Link href={`/app/${project.id}/flags/${f.id}`} className="mono">{f.expectationId}</Link></td>
                  <td className="mono">{f.payee ?? ""}</td>
                  <td className="mono">{f.amount ?? ""}</td>
                  <td className="mono">{f.ref.seq}</td>
                  <td className="mono">{f.at.toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
