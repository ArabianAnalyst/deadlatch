import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found — Deadlatch",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="wrap logwrap">
      <header className="log-hd">
        <div className="eyebrow">404</div>
        <h1>Nothing at this address.</h1>
        <p>The page may have moved, or the link was never right. Everything on this site is one of these.</p>
      </header>
      <ul className="nf-links">
        <li><Link href="/">Home, the three primitives and the control loop</Link></li>
        <li><Link href="/audit">The Agent Payment Security Audit, run in your browser</Link></li>
        <li><Link href="/log">The Log, notes written from the build</Link></li>
      </ul>
    </main>
  );
}
