"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function Lock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 9V6.5a4 4 0 1 1 8 0V9" stroke="#37D07E" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="#E8EDF3" strokeWidth="1.6" />
      <circle cx="10" cy="13" r="1.4" fill="#37D07E" />
    </svg>
  );
}

type NavLink = { href: string; label: string; anchor?: boolean; prefetch?: false };

/** The App link is never prefetched. Prefetching it follows a redirect into the sign-in host and logs a cross-origin error on every page. */
const LINKS: NavLink[] = [
  { href: "/try", label: "Try" },
  { href: "/#stack", label: "Stack", anchor: true },
  { href: "/#why", label: "Why open", anchor: true },
  { href: "/audit", label: "Audit" },
  { href: "/log", label: "Log" },
  { href: "/app", label: "App", prefetch: false },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items = LINKS.map((l) =>
    l.anchor ? (
      <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
        {l.label}
      </a>
    ) : (
      <Link key={l.href} href={l.href} prefetch={l.prefetch} onClick={() => setOpen(false)}>
        {l.label}
      </Link>
    ),
  );

  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="brand" href="/" aria-label="Deadlatch home">
          <Lock />
          deadlatch
        </Link>
        <div className="nav-links">{items}</div>
        <div className="nav-right">
          <a className="npm" href="https://www.npmjs.com/package/@olurabian/purse">
            npm i <b>@olurabian/purse</b>
          </a>
          <a className="ghlink" href="https://github.com/ArabianAnalyst">
            GitHub ↗
          </a>
          <button
            className="nav-menu-btn"
            type="button"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      <div id="nav-menu" className="nav-menu" hidden={!open}>
        <div className="wrap nav-menu-in">{items}</div>
      </div>
    </nav>
  );
}
