"use client";

export default function TryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap logwrap app try">
      <header className="log-hd">
        <div className="eyebrow">The playground</div>
        <h1>Something on this page broke.</h1>
        <p className="app-muted">The broker and the witness are unaffected. Reload the panels, or open the curl beside any result and run it yourself.</p>
        <p><button className="btn" onClick={() => reset()}>Reload the panels</button></p>
      </header>
    </main>
  );
}
