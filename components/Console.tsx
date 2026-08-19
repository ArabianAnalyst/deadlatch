"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Action,
  type ChainEntry,
  type Decision,
  type Verdict,
  appendRecord,
  evaluate,
  formatUsd,
  POLICY,
  verifyChain,
} from "@/lib/engine";

interface Caught {
  amountCents: number;
  reason: string;
  verdict: Verdict;
}

const STREAM: Action[] = [
  { amountCents: 1200, payee: "api.stripe.com" },
  { amountCents: 420, payee: "s3.aws.amazon.com" },
  { amountCents: 8000, payee: "api.stripe.com" },
  { amountCents: 3000, payee: "unknown-vendor.io" },
  { amountCents: 1500, payee: "api.stripe.com" },
  { amountCents: 14000, payee: "api.stripe.com" },
  { amountCents: 2200, payee: "api.stripe.com" },
];

const MANUAL: Record<string, Action> = {
  allow: { amountCents: 1200, payee: "api.stripe.com" },
  hold: { amountCents: 8000, payee: "api.stripe.com" },
  deny: { amountCents: 3000, payee: "unknown-vendor.io" },
};

export default function Console() {
  const [action, setAction] = useState<Action>(STREAM[0]!);
  const [decision, setDecision] = useState<Decision>({ verdict: "allow", reason: "within policy" });
  const [spent, setSpent] = useState(0);
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [brokenFrom, setBrokenFrom] = useState<number | null>(null);
  const [caught, setCaught] = useState<Caught[]>([]);
  const [running, setRunning] = useState(true);
  const [flashKey, setFlashKey] = useState(0);

  const spentRef = useRef(0);
  const chainRef = useRef<ChainEntry[]>([]);
  const caughtRef = useRef<Caught[]>([]);
  const idxRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useRef(false);

  const fire = useCallback(async (a: Action) => {
    const d = evaluate(a, spentRef.current);
    setAction(a);
    setDecision(d);
    setFlashKey((k) => k + 1);
    if (d.verdict === "allow") {
      spentRef.current += a.amountCents;
      setSpent(spentRef.current);
    }
    const entry = await appendRecord(chainRef.current, {
      amountCents: a.amountCents,
      payee: a.payee,
      verdict: d.verdict,
    });
    chainRef.current = [...chainRef.current, entry];
    setChain(chainRef.current);
    const v = await verifyChain(chainRef.current);
    setBrokenFrom(v.ok ? null : v.brokenAt ?? null);
    if (d.verdict !== "allow") {
      caughtRef.current = [...caughtRef.current, { amountCents: a.amountCents, reason: d.reason, verdict: d.verdict }];
      setCaught(caughtRef.current);
    }
  }, []);

  const tamper = useCallback(async () => {
    if (chainRef.current.length < 2) return;
    const next = chainRef.current.map((e, i) =>
      i === 1 ? { ...e, record: { ...e.record, amountCents: 99900 } } : e,
    );
    chainRef.current = next;
    setChain(next);
    const v = await verifyChain(next);
    setBrokenFrom(v.ok ? null : v.brokenAt ?? null);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setRunning(true);
    if (timer.current) return;
    timer.current = setInterval(() => {
      void fire(STREAM[idxRef.current % STREAM.length]!);
      idxRef.current += 1;
    }, 2300);
  }, [fire]);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void (async () => {
      await fire(STREAM[0]!);
      idxRef.current = 1;
      if (!reduced.current) start();
      else setRunning(false);
    })();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = chain.slice(-5);
  const pct = Math.min(100, (spent / POLICY.maxPerDayCents) * 100);
  const fillClass = pct >= 100 ? "fill max" : pct >= 75 ? "fill warn" : "fill";
  const flashBg =
    decision.verdict === "allow" ? "var(--allow-bg)" : decision.verdict === "hold" ? "var(--hold-bg)" : "var(--deny-bg)";

  return (
    <div className="console" aria-label="Live Deadlatch decision console">
      <div className="c-bar">
        <span className="dot live" aria-hidden="true" />
        <span className="title">DEADLATCH</span>
        <span>live console</span>
        <span className="right">enforcing</span>
      </div>
      <div className="c-body">
        <div className="policy" aria-label="Active policy">
          <span className="p">
            max/action <b>$100</b>
          </span>
          <span className="p">
            max/day <b>$200</b>
          </span>
          <span className="p">
            approval &gt; <b>$50</b>
          </span>
          <span className="p">
            allow <b>api.stripe.com, *.aws</b>
          </span>
        </div>

        <div className="stage">
          <div key={flashKey} className="flash on" style={{ background: flashBg }} aria-hidden="true" />
          <div className="req">
            <span className="arrow">agent &#8594;</span> spend <b>{formatUsd(action.amountCents)}</b> to{" "}
            <b>{action.payee}</b>
          </div>
          <div className="verdict">
            <span className={`pill ${decision.verdict}`}>{decision.verdict}</span>
            <span className="reason">{decision.reason}</span>
          </div>
          <div className="meter">
            <div className="lab">
              <span>daily spend</span>
              <b>{formatUsd(spent)} / $200.00</b>
            </div>
            <div className="track">
              <div className={fillClass} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="controls">
          <button className="g" onClick={() => void fire(MANUAL.allow!)}>
            spend $12
          </button>
          <button className="a" onClick={() => void fire(MANUAL.hold!)}>
            spend $80
          </button>
          <button className="r" onClick={() => void fire(MANUAL.deny!)}>
            spend $30 &#183; off&#8209;policy
          </button>
          <button className="auto" onClick={() => (running ? stop() : start())}>
            {running ? "❙❙ pause" : "▶ resume"}
          </button>
        </div>

        <div className="modrow">
          <div className="mod">
            <div className="mh">
              <span>blackbox &#183; hash chain</span>
              <span className="pkg">prove</span>
            </div>
            <div className="log">
              {last.map((e) => {
                const broken = brokenFrom !== null && e.seq >= brokenFrom;
                return (
                  <div key={e.seq} className={`rec ${e.record.verdict}${broken ? " broken" : ""}`}>
                    <span className="sq" />
                    <span>
                      #{e.seq} {formatUsd(e.record.amountCents)}
                    </span>
                    <span className="h" style={{ marginLeft: "auto" }}>
                      {e.hash.slice(0, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="verify">
              <span className="st">
                verify(){" "}
                {brokenFrom === null ? (
                  <span className="ok">&#10003; ok</span>
                ) : (
                  <span className="bad">&#10007; broken at #{brokenFrom}</span>
                )}
              </span>
              <button onClick={() => void tamper()}>tamper a record</button>
            </div>
          </div>

          <div className="mod">
            <div className="mh">
              <span>tripwire &#183; watch</span>
              <span className="pkg">detect</span>
            </div>
            <div className="tw">
              <div className={`cnt${caught.length === 0 ? " zero" : ""}`}>
                {caught.length}
                <small>actions caught</small>
              </div>
              <div>
                {caught
                  .slice(-3)
                  .reverse()
                  .map((it, i) => (
                    <div className="item" key={i}>
                      <span className={it.verdict === "deny" ? "d" : "a"}>
                        {it.verdict === "deny" ? "✗" : "⚠"}
                      </span>
                      <span>
                        {formatUsd(it.amountCents)} &#183; {it.reason}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
