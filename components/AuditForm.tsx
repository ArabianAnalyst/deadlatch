"use client";
import { useMemo, useState } from "react";
import { questions, score, render, DIMENSION_LABEL } from "@olurabian/audit";
import type { Intake, Readout, Field } from "@olurabian/audit";

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

function FieldInput({ q, f, value, onChange }: { q: string; f: Field; value: string; onChange: (v: string) => void }) {
  const id = `${q}-${f.key}`;
  if (f.kind === "choice") {
    return (
      <label className="af-field" htmlFor={id}>
        <span>{f.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Unknown</option>
          {(f.choices ?? []).filter((c) => c.value !== "unknown").map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
    );
  }
  if (f.kind === "boolean") {
    return (
      <label className="af-field" htmlFor={id}>
        <span>{f.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      </label>
    );
  }
  const hint = f.kind === "money" ? "for example $50 or 50 GBP" : f.kind === "list" ? "comma separated" : f.kind === "number" ? "a number" : "";
  const inputMode = f.kind === "number" ? "numeric" : f.kind === "money" ? "decimal" : undefined;
  return (
    <label className="af-field" htmlFor={id}>
      <span>{f.label}{f.optional ? ", optional" : ""}</span>
      <input id={id} value={value} placeholder={hint} inputMode={inputMode} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function AuditForm() {
  const [answers, setAnswers] = useState<Answers>({});
  const [readout, setReadout] = useState<Readout | null>(null);
  const [copied, setCopied] = useState(false);
  const set = (q: string, k: string, v: string) => setAnswers((a) => ({ ...a, [q]: { ...(a[q] ?? {}), [k]: v } }));
  const intake = useMemo(() => toIntake(answers), [answers]);

  const run = () => { setReadout(score(intake)); setCopied(false); };
  const copyMd = async () => { if (!readout) return; await navigator.clipboard.writeText(render(readout, "markdown")); setCopied(true); };
  const saveHtml = () => {
    if (!readout) return;
    const blob = new Blob([render(readout, "html")], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "agent-payment-security-audit.html"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="af">
      <form className="af-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        {questions.map((q, i) => (
          <fieldset key={q.id} className="af-q">
            <legend><span className="mono">{String(i + 1).padStart(2, "0")}</span> {q.title}</legend>
            <p className="af-prompt">{q.prompt}</p>
            {q.fields.map((f) => <FieldInput key={f.key} q={q.id} f={f} value={answers[q.id]?.[f.key] ?? ""} onChange={(v) => set(q.id, f.key, v)} />)}
            <label className="af-field" htmlFor={`${q.id}-notes`}><span>Notes, optional. Echoed in the report, never scored.</span>
              <input id={`${q.id}-notes`} value={answers[q.id]?.notes ?? ""} onChange={(e) => set(q.id, "notes", e.target.value)} /></label>
          </fieldset>
        ))}
        <div className="af-actions">
          <button type="submit" className="btn primary">Score it</button>
          <span className="af-note">Runs in your browser. Nothing you type leaves this page.</span>
        </div>
      </form>

      {readout && (
        <section className="af-readout" aria-live="polite">
          <div className="af-tools">
            <button type="button" className="btn" onClick={copyMd}>{copied ? "Copied" : "Copy as Markdown"}</button>
            <button type="button" className="btn" onClick={saveHtml}>Save as HTML</button>
          </div>
          <h3><span className="mono">1</span> Posture</h3><p>{readout.posture}</p>
          <h3><span className="mono">2</span> Money-path map</h3>
          <ul>{readout.moneyPaths.map((p, i) => <li key={i}>{p.path}</li>)}</ul>
          <h3><span className="mono">3</span> Exposure</h3>
          <ul className="af-exposure">{readout.exposure.map((e) => (
            <li key={e.dimension} className={e.verdict.toLowerCase()}><b>{DIMENSION_LABEL[e.dimension]}.</b> <span className="af-verdict">{e.verdict}.</span> {e.finding}{e.question ? <span className="af-ask"> Ask. {e.question}</span> : null}</li>
          ))}</ul>
          <h3><span className="mono">4</span> Top breaches</h3>
          {readout.topBreaches.length ? <ol>{readout.topBreaches.map((b) => <li key={b.dimension}><b>{DIMENSION_LABEL[b.dimension]}.</b> {b.blastRadius} <span className="af-fix">Fix. {b.fix}</span></li>)}</ol> : <p>None from what was described.</p>}
          <h3><span className="mono">5</span> Which is open</h3>
          <p>Forgery {readout.open.forgery}, misdirection {readout.open.misdirection}. {readout.open.why}</p>
          <h3><span className="mono">6</span> Shortest path</h3>
          <ol>{readout.shortestPath.map((s, i) => <li key={i}>{s.step}</li>)}</ol>
          <p className="af-last">{readout.lastLine.replace(/https?:\/\/\S+/, "")}<a href="https://olurabian.com/work">olurabian.com/work</a></p>
          {readout.notes.length > 0 && (<><h3>Notes you gave</h3><ul>{readout.notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul></>)}
        </section>
      )}
    </div>
  );
}
