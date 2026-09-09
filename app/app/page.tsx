import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { projectsFor } from "@/lib/watch/queries";
import CreateProject from "@/components/app/CreateProject";

export const metadata: Metadata = { title: "Projects — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";
const ORIGIN = process.env.APP_ORIGIN ?? "https://www.deadlatch.dev";

export default async function Projects() {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const list = await projectsFor(db, userId);
  return (
    <main className="wrap logwrap app">
      <header className="log-hd">
        <div className="eyebrow">Watch</div>
        <h1>Projects</h1>
        <p>A project is one receipt stream with one key. Point a monitor at it with three environment lines and its flags land here.</p>
      </header>
      {list.length > 0 ? (
        <div className="log-list">
          {list.map((p) => (
            <Link key={p.id} href={`/app/${p.id}`} className="log-item">
              <span className="log-date mono">{p.stream}</span>
              <span className="log-copy"><span className="log-title">{p.name}</span><span className="log-desc">created {p.createdAt.toISOString().slice(0, 10)}</span></span>
              <span className="log-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      ) : null}
      <h2 className="app-h2">{list.length > 0 ? "New project" : "Your first project"}</h2>
      <CreateProject origin={ORIGIN} />
    </main>
  );
}
