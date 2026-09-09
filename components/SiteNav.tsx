import Link from "next/link";

function Lock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 9V6.5a4 4 0 1 1 8 0V9" stroke="#37D07E" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="#E8EDF3" strokeWidth="1.6" />
      <circle cx="10" cy="13" r="1.4" fill="#37D07E" />
    </svg>
  );
}

export default function SiteNav() {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="brand" href="/" aria-label="Deadlatch home">
          <Lock />
          deadlatch
        </Link>
        <div className="nav-links">
          <a href="/#stack">Stack</a>
          <a href="/#why">Why open</a>
          <a href="/#audit">Audit</a>
          <Link href="/log">Log</Link>
          <Link href="/app">App</Link>
        </div>
        <div className="nav-right">
          <a className="npm" href="https://www.npmjs.com/package/@olurabian/purse">
            npm i <b>@olurabian/purse</b>
          </a>
          <a className="ghlink" href="https://github.com/ArabianAnalyst">
            GitHub ↗
          </a>
        </div>
      </div>
    </nav>
  );
}
