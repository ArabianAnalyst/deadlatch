import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { keyInfo, projectFor } from "@/lib/watch/queries";
import { configLines } from "@/lib/watch/config-lines";
import { KEY_PREFIX } from "@/lib/watch/keys";
import { setQuietAction } from "@/app/app/actions";
import RotateKey from "@/components/app/RotateKey";

export const metadata: Metadata = { title: "Settings — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";
const ORIGIN = process.env.APP_ORIGIN ?? "https://www.deadlatch.dev";

export default async function SettingsPage({ params }: { params: Promise<{ project: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const { project: id } = await params;
  const project = await projectFor(db, userId, id);
  if (!project) notFound();
  const key = await keyInfo(db, project.id);
  return (
    <main className="wrap logwrap app">
      <Link href={`/app/${project.id}`} className="log-back mono">← {project.name}</Link>
      <header className="log-hd">
        <div className="eyebrow">Settings</div>
        <h1>{project.name}</h1>
      </header>
      <section className="app-card">
        <div className="eyebrow">Project key</div>
        <p className="mono">{key ? `${KEY_PREFIX}${key.prefix}… made ${key.createdAt.toISOString().slice(0, 10)}` : "no live key"}</p>
        <p>The broker's monitor reads these three lines. The key itself was shown once when it was made; rotating makes a new one and revokes the old one, and a monitor still using the old key stops with a 403.</p>
        <pre className="mono app-pre">{configLines(null, project.stream, ORIGIN)}</pre>
        <RotateKey projectId={project.id} stream={project.stream} origin={ORIGIN} />
      </section>
      <section className="app-card">
        <div className="eyebrow">Alert</div>
        <p>One email on the first flag after a quiet period. Currently {Math.round(project.alertQuietMs / 3_600_000 * 10) / 10} hours.</p>
        <form action={setQuietAction} className="app-inline">
          <input type="hidden" name="projectId" value={project.id} />
          <label>Quiet period, hours <input name="hours" type="number" min={0.02} max={720} step={0.5} defaultValue={project.alertQuietMs / 3_600_000} /></label>
          <button className="btn" type="submit">Save</button>
        </form>
      </section>
    </main>
  );
}
