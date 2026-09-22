import { Fragment } from "react";

/** The control loop, as three static panels. Server rendered, no script, replaces the react-flow diagram. */
const STEPS = [
  { k: "1 · enforce", t: "Purse decides it", s: "caps, allowlist, approval out of band" },
  { k: "2 · prove", t: "blackbox records it", s: "hash chained, head anchored outside" },
  { k: "3 · watch", t: "Tripwire watches the outcome", s: "flags the wrong action inside one interval" },
] as const;

export default function ControlLoop() {
  return (
    <div className="loop" role="list">
      {STEPS.map((st, i) => (
        <Fragment key={st.k}>
          {i > 0 && <div className="loop-arrow" aria-hidden="true" />}
          <div className="loop-step" role="listitem">
            <div className="loop-k">{st.k}</div>
            <div className="loop-t">{st.t}</div>
            <div className="loop-s">{st.s}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
