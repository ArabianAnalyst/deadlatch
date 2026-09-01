import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts, formatDate } from "@/lib/log";

export const metadata: Metadata = {
  title: "The Log — Deadlatch",
  description:
    "Notes on governing AI agents that act. Enforcement, tamper-evident proof, and the problems still open, written from the build.",
  alternates: { canonical: "https://deadlatch.dev/log" },
};

export default function LogIndex() {
  const posts = getAllPosts();
  return (
    <main className="wrap logwrap">
      <header className="log-hd">
        <div className="eyebrow">The Log</div>
        <h1>Notes on governing agents that act.</h1>
        <p>Enforcement, tamper-evident proof, and the problems still open. Written from the build, not the pitch.</p>
      </header>

      <div className="log-list">
        {posts.map((p) => (
          <Link key={p.slug} href={`/log/${p.slug}`} className="log-item">
            <span className="log-date mono">{formatDate(p.date)}</span>
            <span className="log-copy">
              <span className="log-title">{p.title}</span>
              <span className="log-desc">{p.description}</span>
            </span>
            <span className="log-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
