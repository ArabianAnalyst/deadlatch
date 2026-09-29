"use client";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { questions, score, render, DIMENSION_LABEL, exampleIntake } from "@olurabian/audit";
import type { Intake, Field, Money, Question, Verdict } from "@olurabian/audit";

type Answers = Record<string, Record<string, string>>;

function toIntake(a: Answers): Intake {
  const out: Record<string, Record<string, unknown>> = {};
  for (const q of questions) {
    const raw = a[q.id] ?? {};
    const obj: Record<string, unknown> = {};
    let any = false;
    for (const f of q.fields) {
      const v = (raw[f.key] ?? "").trim();
      if (f.kind === "choice") { obj[f.key] = v || "unknown"; if (v) any = true; }
      else if (f.kind === "list") { obj[f.key] = v ? v.split(",").map((s) => s.trim()).filter(Boolean) : "unknown"; if (v) any = true; }
      else if (f.kind === "boolean") { obj[f.key] = v === "yes" ? true : v === "no" ? false : "unknown"; if (v) any = true; }
      else if (f.kind === "number") { obj[f.key] = v && Number.isFinite(Number(v)) ? Number(v) : "unknown"; if (v) any = true; }
      else if (f.kind === "money") { const m = v.match(/^([£$€])?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{3})?$/); if (m) { const sym: Record<string, string> = { "£": "GBP", "$": "USD", "€": "EUR" }; obj[f.key] = { amount: Number(m[2]), currency: (m[3] ?? (m[1] ? sym[m[1]] : undefined) ?? "USD").toUpperCase() }; any = true; } }
      else if (v) { obj[f.key] = v; any = true; }
    }
    const notes = (raw.notes ?? "").trim();
    if (notes) { obj.notes = notes; any = true; }
    if (any) out[q.id] = obj;
  }
  return out as unknown as Intake;
}

/** The inverse of toIntake, so a filled intake (the example) can be edited in the form. */
function fromIntake(it: Intake): { answers: Answers; notes: Record<string, boolean> } {
  const all = it as unknown as Record<string, Record<string, unknown> | undefined>;
  const answers: Answers = {};
  const notes: Record<string, boolean> = {};
  for (const q of questions) {
    const src = all[q.id] ?? {};
    const o: Record<string, string> = {};
    for (const f of q.fields) {
      const v = src[f.key];
      if (v === undefined || v === "unknown") continue;
      if (f.kind === "list") o[f.key] = (v as string[]).join(", ");
      else if (f.kind === "money") {
        const m = v as Money;
        const c = (m.currency ?? "USD").toUpperCase();
        const amount = Number.isInteger(m.amount) ? String(m.amount) : m.amount.toFixed(2);
        o[f.key] = (c === "USD" ? "$" : c === "GBP" ? "£" : "") + amount + (c === "USD" || c === "GBP" ? "" : " " + c);
      }
      else if (f.kind === "boolean") o[f.key] = v ? "yes" : "no";
      else o[f.key] = String(v);
    }
    if (typeof src.notes === "string" && src.notes) { o.notes = src.notes; notes[q.id] = true; }
    answers[q.id] = o;
  }
  return { answers, notes };
}

const answered = (a: Answers, q: Question) => Object.entries(a[q.id] ?? {}).some(([k, v]) => k !== "notes" && String(v).trim() !== "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function FieldInput({ q, f, value, onChange }: { q: string; f: Field; value: string; onChange: (v: string) => void }) {
  const id = `${q}-${f.key}`;
  const label = <label htmlFor={id}>{f.label}{f.optional ? <> <small>optional</small></> : null}</label>;
  if (f.kind === "choice" || f.kind === "boolean") {
    const opts = f.kind === "boolean" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : (f.choices ?? []).filter((c) => c.value !== "unknown");
    return (
      <div className="af-f">
        {label}
        <select id={id} className={value ? undefined : "af-unk"} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Unknown, ask me later</option>
          {opts.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
    );
  }
  const hint = f.kind === "money" ? "for example $50 or 50 GBP" : f.kind === "list" ? "separate with commas" : f.kind === "number" ? "a number" : "";
  const inputMode = f.kind === "number" ? "numeric" : f.kind === "money" ? "decimal" : undefined;
  return (
    <div className="af-f">
      {label}
      <input id={id} value={value} placeholder={hint} inputMode={inputMode} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const EXAMPLE = () => fromIntake(exampleIntake());

export default function AuditForm({ children }: { children?: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>(() => EXAMPLE().answers);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>(() => EXAMPLE().notes);
  const [openId, setOpenId] = useState<string | null>("limits");
  const [isExample, setIsExample] = useState(true);
  const [copied, setCopied] = useState(false);
  const [focusNote, setFocusNote] = useState<string | null>(null);

  const readout = useMemo(() => score(toIntake(answers)), [answers]);

  useEffect(() => {
    if (!focusNote) return;
    document.getElementById(`${focusNote}-notes`)?.focus();
    setFocusNote(null);
  }, [focusNote]);

  const set = (q: string, k: string, v: string) => { setAnswers((a) => ({ ...a, [q]: { ...(a[q] ?? {}), [k]: v } })); setCopied(false); };
  const loadExample = () => { const ex = EXAMPLE(); setAnswers(ex.answers); setNoteOpen(ex.notes); setOpenId("limits"); setIsExample(true); setCopied(false); };
  const startBlank = () => { setAnswers({}); setNoteOpen({}); setOpenId(questions[0].id); setIsExample(false); setCopied(false); };
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const addNote = (id: string) => { setNoteOpen((n) => ({ ...n, [id]: true })); setFocusNote(id); };

  const copyMd = () => {
    const md = render(readout, "markdown");
    try { navigator.clipboard.writeText(md).then(() => setCopied(true), () => {}); } catch { /* clipboard unavailable */ }
  };
  const saveHtml = () => {
    if (!readout) return;
    const blob = new Blob([render(readout, "html")], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "agent-payment-security-audit.html"; a.click(); URL.revokeObjectURL(a.href);
  };
  const seeVerdict = () => document.getElementById("af-rd")?.scrollIntoView({ behavior: "smooth" });

  const done = questions.filter((q) => answered(answers, q)).length;
  const posture = cap(readout.posture);
  const count = (v: Verdict) => readout.exposure.filter((e) => e.verdict === v).length;
  const breach = readout.topBreaches[0];
  const unknowns = readout.exposure.filter((e) => e.verdict === "Unknown");

  return (
    <div className="af">
      <div className="af-actions">
        <button type="button" className="btn primary" onClick={loadExample}>Load an example agent</button>
        <button type="button" className="btn" onClick={startBlank}>Start blank</button>
        {children}
      </div>

      <div className="af-layout">
        <div className="af-main">
          <div className="af-qhead"><h2>Your setup</h2><span className="af-progress" aria-live="polite" aria-atomic="true">{done} of {questions.length} answered</span></div>
          <div className="af-bar" aria-hidden="true"><i style={{ width: `${(done / questions.length) * 100}%` }} /></div>
          {isExample && <p className="af-exnote">Example agent loaded. A common setup, a rail key in the runtime and caps that bite only at settlement. Edit any answer and watch the verdict move.</p>}

          {questions.map((q, i) => {
            const open = q.id === openId;
            const isDone = answered(answers, q);
            const next = questions[i + 1];
            return (
              <div key={q.id} className={open ? "af-q af-open" : "af-q"}>
                <button type="button" className="af-q-h" aria-expanded={open} aria-controls={`${q.id}-body`} onClick={() => toggle(q.id)}>
                  <span className="af-q-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="af-q-t">{q.title}</span>
                  <span className={isDone ? "af-state af-done" : "af-state"}>{isDone ? "answered" : "unknown"}</span>
                  <span className="af-chev" aria-hidden="true">›</span>
                </button>
                <div className="af-q-b" id={`${q.id}-body`}>
                  <p className="af-prompt">{q.prompt}</p>
                  {q.fields.map((f) => <FieldInput key={f.key} q={q.id} f={f} value={answers[q.id]?.[f.key] ?? ""} onChange={(v) => set(q.id, f.key, v)} />)}
                  {noteOpen[q.id] ? (
                    <div className="af-f">
                      <label htmlFor={`${q.id}-notes`}>Note <small>shown in the report, never scored</small></label>
                      <input id={`${q.id}-notes`} value={answers[q.id]?.notes ?? ""} autoComplete="off" onChange={(e) => set(q.id, "notes", e.target.value)} />
                    </div>
                  ) : (
                    <button type="button" className="af-addnote" onClick={() => addNote(q.id)}>+ Add a note</button>
                  )}
                  {next && <button type="button" className="af-next" onClick={() => setOpenId(next.id)}>Next, {next.title.toLowerCase()} ›</button>}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="af-rd" id="af-rd" aria-label="Live verdict">
          <div className="af-rd-k">Live verdict</div>
          <div className="af-posture" aria-live="polite" aria-atomic="true">{posture}</div>
          <div className="af-dims">
            {readout.exposure.map((e) => (
              <div key={e.dimension} className={"dim af-dim " + e.verdict} title={e.finding}>
                <span>{DIMENSION_LABEL[e.dimension]}</span><b>{e.verdict.toUpperCase()}</b>
              </div>
            ))}
          </div>
          <div className="af-tally">
            <span className="af-x">{count("Exposed")} exposed</span>
            <span className="af-p">{count("Partial")} partial</span>
            <span className="af-c">{count("Closed")} closed</span>
            <span>{count("Unknown")} unknown</span>
          </div>
          <div className="af-sec">
            <div className="af-rd-k">What an attacker can do</div>
            <div className="af-threats">
              <span className={"af-th af-" + readout.open.forgery}>Forgery {readout.open.forgery}</span>
              <span className={"af-th af-" + readout.open.misdirection}>Misdirection {readout.open.misdirection}</span>
            </div>
            <p className="af-why">{readout.open.why}</p>
          </div>
          {breach && (
            <div className="af-sec"><div className="af-rd-k">Blast radius</div><p className="af-blast"><strong>{breach.blastRadius}</strong></p></div>
          )}
          {readout.shortestPath.length > 0 && (
            <div className="af-sec"><div className="af-rd-k">Shortest path to closed</div>
              <ol className="af-path">{readout.shortestPath.map((s, i) => <li key={i}>{s.step}</li>)}</ol>
            </div>
          )}
          {unknowns.length > 0 && (
            <div className="af-sec"><div className="af-rd-k">Ask your team first</div>
              <p className="af-unk-q">{unknowns[0].question}{unknowns.length > 1 ? ` (+${unknowns.length - 1} more in the report)` : ""}</p>
            </div>
          )}
          <div className="af-rd-actions">
            <button type="button" className="btn primary" onClick={copyMd}>Copy report as markdown</button>
            <button type="button" className="btn" onClick={saveHtml}>Save as HTML</button>
            {copied && <span className="af-copied">Copied</span>}
          </div>
        </aside>
      </div>

      <div className="af-mbar">
        <div className="af-mbar-t"><b>{posture}</b><span>{count("Exposed")} exposed, {count("Closed")} closed, {count("Unknown")} unknown</span></div>
        <button type="button" className="btn" onClick={seeVerdict}>See verdict</button>
      </div>
    </div>
  );
}
