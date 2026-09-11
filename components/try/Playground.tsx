"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Preset = "allowed" | "held" | "over-cap" | "off-list";
interface Decision { decision?: string; reason?: string; grantId?: string; pendingId?: string; explain?: { rule?: string; policyVersion?: string }; curl?: string; error?: string; retryAfterSec?: number }
interface Executed { status?: string; reason?: string; receipt?: { ok?: boolean; ref?: string; paidAmount?: { amount: number; currency: string } }; curl?: string; error?: string }
interface Status { state?: string; error?: string }
interface Card { key: number; label: string; decision: Decision | null; executed: Executed | null; status: Status | null; note: string | null }
interface Env { seq: number; id: string; ts: string; kind: string; payload: { status?: string; event?: string; reason?: string; grantId?: string }; prevHash: string; hash: string }
interface ChainDoc { total: number; head: { seq: number; hash: string } | null; records: Env[]; error?: string }
interface AnchorDoc { stream: string; total: number; head: { seq: number; hash: string } | null; lastAnchor: { seq: number; head: string; at: string; logIndex: string; logUrl: string; logHost: string | null } | null; verify: { ok: boolean; coveredUpTo: number | null; reason: string | null }; verifyCommand: string; error?: string }
interface FlagRow { id: string; expectationId: string; reason: string; ref: { seq: number }; payee: string | null; amount: string | null; at: string; window?: { count?: number } }
interface FlagsDoc { monitor: { state: "never" | "ok" | "amber" | "red"; cursorSeq: number | null }; flags: FlagRow[]; error?: string }

const BUTTONS: { preset: Preset; label: string }[] = [
  { preset: "allowed", label: "Pay $12.50" },
  { preset: "held", label: "Pay $35.00" },
  { preset: "over-cap", label: "Pay $75.00" },
  { preset: "off-list", label: "Pay a payee off the list" },
];
const STATE_LABEL = { never: "no heartbeat yet", ok: "monitor alive", amber: "heartbeat late", red: "heartbeat missing" } as const;
const short = (h: unknown) => (typeof h === "string" && h.length ? h.slice(0, 10) + "…" : "?");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A plain, visitor-facing sentence for an upstream error string. Anything unrecognised passes through as-is. */
function plain(error: string): string {
  if (/witness/.test(error)) return "The witness is not answering.";
  if (/broker/.test(error)) return "The playground broker is not answering.";
  return error;
}

/** Seconds under a minute read as "under a minute"; otherwise whole minutes, singular at one. */
function retryCopy(sec: number): string {
  if (sec < 60) return "Try again in under a minute.";
  const m = Math.ceil(sec / 60);
  return `Try again in ${m} minute${m === 1 ? "" : "s"}.`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ error: "no answer" }))) as T;
  } catch {
    return { error: "no answer" } as T;
  }
}
async function get<T>(path: string): Promise<T> {
  try {
    const r = await fetch(path, { cache: "no-store" });
    return (await r.json().catch(() => ({ error: "no answer" }))) as T;
  } catch {
    return { error: "no answer" } as T;
  }
}

function chipClass(d: Decision | null): string {
  if (!d || d.error) return "try-chip";
  if (d.decision === "allowed") return "try-chip allowed";
  if (d.decision === "needs_approval") return "try-chip held";
  return "try-chip denied";
}
function chipText(d: Decision | null): string {
  if (!d) return "…";
  if (d.error) return "error";
  return d.decision === "needs_approval" ? "held" : d.decision ?? "?";
}

/** The decision card's error line: plain copy, with the /healthz link kept only when the broker is the subject. */
function errorLine(error: string, brokerUrl: string) {
  const msg = plain(error);
  return (
    <p className="app-error mono">
      {msg}
      {msg.includes("broker") && <> · <a href={`${brokerUrl}/healthz`} target="_blank" rel="noopener">health</a></>}
    </p>
  );
}

export default function Playground({ brokerUrl, witnessUrl }: { brokerUrl: string; witnessUrl: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState<ChainDoc | null>(null);
  const [anchor, setAnchor] = useState<AnchorDoc | null>(null);
  const [flags, setFlags] = useState<FlagsDoc | null>(null);
  const [proveError, setProveError] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [watchNote, setWatchNote] = useState<string | null>(null);
  const grants = useRef<Set<string>>(new Set());
  const seq = useRef(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const refreshProve = useCallback(async () => {
    const [c, a] = await Promise.all([get<ChainDoc>("/api/try/chain"), get<AnchorDoc>("/api/try/anchor")]);
    setChain((prev) => (!c.error || !prev ? c : prev));
    setAnchor((prev) => (!a.error || !prev ? a : prev));
    setProveError(c.error ? plain(c.error) : a.error ? plain(a.error) : null);
  }, []);
  const refreshWatch = useCallback(async () => {
    const f = await get<FlagsDoc>("/api/try/flags");
    setFlags((prev) => (!f.error || !prev ? f : prev));
    setWatchError(f.error ? plain(f.error) : null);
  }, []);

  useEffect(() => { void refreshProve(); void refreshWatch(); }, [refreshProve, refreshWatch]);

  const push = (label: string): number => {
    const key = ++seq.current;
    setCards((cs) => [{ key, label, decision: null, executed: null, status: null, note: null }, ...cs].slice(0, 12));
    return key;
  };
  const patch = (key: number, p: Partial<Card>) => setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...p } : c)));

  const spend = useCallback(async (preset: Preset, label: string): Promise<boolean> => {
    const key = push(label);
    const d = await post<Decision>("/api/try/request", { preset });
    patch(key, { decision: d });
    if (d.error) {
      patch(key, { note: d.retryAfterSec ? `Thirty spends per ten minutes per visitor. ${retryCopy(d.retryAfterSec)}` : null });
      return false;
    }
    if (d.explain?.rule === "velocity" && /daily cap/.test(d.reason ?? "")) patch(key, { note: "The playground spent its day. The cap rolls over twenty-four hours, and that is the product working." });
    if (d.decision === "allowed" && d.grantId) {
      grants.current.add(d.grantId);
      const x = await post<Executed>("/api/try/execute", { grantId: d.grantId });
      patch(key, { executed: x });
      void refreshProve();
      return x.status === "paid";
    }
    if (d.decision === "needs_approval" && d.pendingId) {
      patch(key, { note: "Held for a human. Nobody is here, so this one expires in fifteen minutes." });
      const pendingId = d.pendingId;
      void (async () => {
        for (let i = 0; i < 12; i++) {
          await wait(5000);
          if (!mounted.current) return;
          const s = await post<Status>("/api/try/status", { pendingId });
          patch(key, { status: s });
          if (s.state && s.state !== "pending") break;
        }
      })();
    }
    void refreshProve();
    return false;
  }, [refreshProve]);

  const one = async (preset: Preset, label: string) => {
    if (busy || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await spend(preset, label); } finally { busyRef.current = false; setBusy(false); }
  };

  const five = async () => {
    if (busy || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setWatchNote("Five spends going out, one a second.");
    try {
      for (let i = 1; i <= 5; i++) {
        const ok = await spend("allowed", `Pay $12.50, ${i} of 5`);
        if (!ok) { setWatchNote("The run stopped early, see the last card."); return; }
        if (i < 5) await wait(1000);
      }
      busyRef.current = false;
      setBusy(false);
      const seen = await get<FlagsDoc>("/api/try/flags");
      if (!seen.error) setFlags((prev) => (seen.error && prev ? prev : seen));
      const known = new Set((seen.flags ?? []).map((f) => f.id));
      const started = Date.now();
      setWatchNote("Watching for the flag. The monitor reads the chain every fifteen seconds.");
      for (let t = 0; t < 18; t++) {
        await wait(5000);
        if (!mounted.current) return;
        const doc = await get<FlagsDoc>("/api/try/flags");
        setFlags((prev) => (!doc.error || !prev ? doc : prev));
        setWatchError(doc.error ? plain(doc.error) : null);
        const fresh = (doc.flags ?? []).find((f) => !known.has(f.id));
        if (fresh) { setWatchNote(`Flagged ${Math.round((Date.now() - started) / 1000)} seconds after the fifth spend.`); return; }
      }
      setWatchNote("No flag inside ninety seconds. The monitor may be behind, the panel keeps the last state it had.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const mine = (e: Env) => Boolean(e.payload?.grantId && grants.current.has(e.payload.grantId));
  const myTop = chain?.records?.find(mine)?.seq ?? null;
  const covered = anchor?.verify?.coveredUpTo ?? null;

  return (
    <div className="try-grid">
      <section className="app-card try-panel">
        <div className="eyebrow">Enforce</div>
        <p className="app-muted">Each press is one call to the broker's public agent port with a fixed body. The broker answers with its decision and the rule that fired.</p>
        <div className="try-buttons">
          {BUTTONS.map((b) => <button key={b.preset} className="btn" disabled={busy} onClick={() => void one(b.preset, b.label)}>{b.label}</button>)}
          <button className="btn primary" disabled={busy} onClick={() => void five()}>Five in a row</button>
        </div>
        <div className="try-cards">
          {cards.length === 0 && <p className="app-muted">Nothing sent yet.</p>}
          {cards.map((c) => (
            <article key={c.key} className="try-card">
              <div className="try-card-hd"><span className={chipClass(c.decision)}>{chipText(c.decision)}</span><span className="mono">{c.label}</span></div>
              {c.decision?.error && errorLine(c.decision.error, brokerUrl)}
              {c.decision?.reason && <p className="mono">{c.decision.reason}</p>}
              {c.decision?.explain?.rule && <p className="app-muted mono">rule {c.decision.explain.rule} · policy {c.decision.explain.policyVersion ?? "?"}</p>}
              {c.executed && <p className="mono">{c.executed.status ?? c.executed.error} · {c.executed.reason ?? ""}{c.executed.receipt?.paidAmount ? ` · paid ${c.executed.receipt.paidAmount.amount / 100} ${c.executed.receipt.paidAmount.currency}` : ""}{c.executed.receipt?.ref ? ` · ref ${c.executed.receipt.ref}` : ""}</p>}
              {c.status?.state && <p className="app-muted mono">status {c.status.state}</p>}
              {c.note && <p className="try-note">{c.note}</p>}
              {c.decision?.curl && <details className="try-curl"><summary className="mono">curl</summary><pre className="mono">{c.decision.curl}{c.executed?.curl ? `\n${c.executed.curl}` : ""}</pre></details>}
            </article>
          ))}
        </div>
      </section>

      <section className="app-card try-panel">
        <div className="eyebrow">Prove</div>
        {proveError && <p className="app-error mono">{proveError}</p>}
        {anchor && typeof anchor.total === "number" && (
          <div className="try-anchor">
            <p className="mono">Head at seq {anchor.head?.seq ?? "none"}{anchor.head ? `, hash ${short(anchor.head.hash)}` : ""}.</p>
            {anchor.lastAnchor ? (
              <p className="mono">Last anchored at seq {anchor.lastAnchor.seq}, entry {anchor.lastAnchor.logIndex} in {anchor.lastAnchor.logHost ?? "the log"}, {Math.max(0, Math.round((Date.now() - Date.parse(anchor.lastAnchor.at)) / 60000))} minutes ago.</p>
            ) : <p className="mono">No anchor yet. The witness anchors every five minutes.</p>}
            <p className={anchor.verify.ok ? "mono" : "app-error mono"}>verifyAnchored {anchor.verify.ok ? "ok" : "failed"}{covered !== null ? `, covered up to seq ${covered}` : ""}{anchor.verify.reason ? `, ${anchor.verify.reason}` : ""}.</p>
            {myTop !== null && covered !== null && myTop > covered && <p className="try-note">Your receipt is {myTop - covered} past the last anchor. The witness anchors every five minutes.</p>}
            <details className="try-curl"><summary className="mono">the sceptic's check</summary><pre className="mono">{anchor.verifyCommand}</pre></details>
          </div>
        )}
        <div className="try-recs">
          {chain && typeof chain.total === "number" && chain.records.length === 0 && <p className="app-muted">The chain is empty.</p>}
          {chain?.records?.map((e) => (
            <article key={e.id} className={`try-rec${mine(e) ? " mine" : ""}`}>
              <div className="try-rec-hd"><span className="mono app-muted">seq {e.seq}</span><span className="try-kind mono">{e.kind}</span>{mine(e) && <span className="try-mine mono">yours</span>}<span className="mono">{e.payload?.status ?? ""}{e.payload?.event ? ` · ${e.payload.event}` : ""}</span></div>
              {e.payload?.reason && <p className="app-muted mono">{e.payload.reason}</p>}
              <p className="app-hash mono">prev {short(e.prevHash)} · hash {short(e.hash)}</p>
              <details className="try-curl"><summary className="mono">raw</summary><pre className="mono">{JSON.stringify(e, null, 1)}</pre></details>
            </article>
          ))}
        </div>
      </section>

      <section className="app-card try-panel">
        <div className="eyebrow">Watch</div>
        {watchError && <p className="app-error mono">{watchError}</p>}
        {flags && flags.monitor && (
          <div className="app-status"><span className={`app-dot ${flags.monitor.state}`} aria-hidden="true" /><div><div className="app-status-label">{STATE_LABEL[flags.monitor.state]}</div><div className="mono app-muted">{flags.monitor.cursorSeq !== null ? `cursor ${flags.monitor.cursorSeq}` : "no cursor yet"}</div></div></div>
        )}
        {watchNote && <p className="try-note">{watchNote}</p>}
        <div className="try-flags">
          {flags && flags.monitor && flags.flags && flags.flags.length === 0 && <p className="app-muted">No flags yet. Five in a row changes that.</p>}
          {flags?.flags?.map((f) => (
            <article key={f.id} className="try-flag">
              <div className="try-rec-hd"><span className="try-chip denied">{f.expectationId}</span><span className="mono app-muted">seq {f.ref.seq}</span></div>
              <p className="mono">{f.reason}</p>
              <p className="app-muted mono">{f.payee ?? ""}{f.amount ? ` · ${f.amount}` : ""} · {new Date(f.at).toISOString()}</p>
            </article>
          ))}
        </div>
        <p className="try-cta"><a className="btn" href="/app">Point your own broker at this. Three lines of config.</a></p>
        <p className="app-muted mono">broker {brokerUrl} · witness {witnessUrl}</p>
      </section>
    </div>
  );
}
