import Console from "@/components/Console";
import FlowGraph from "@/components/FlowGraph";

const REPO = {
  purse: "https://github.com/ArabianAnalyst/purse",
  blackbox: "https://github.com/ArabianAnalyst/blackbox",
  tripwire: "https://github.com/ArabianAnalyst/tripwire",
  org: "https://github.com/ArabianAnalyst",
};
const NPM = {
  purse: "https://www.npmjs.com/package/@olurabian/purse",
  blackbox: "https://www.npmjs.com/package/@olurabian/blackbox",
  tripwire: "https://www.npmjs.com/package/@olurabian/tripwire",
};

function Lock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 9V6.5a4 4 0 1 1 8 0V9" stroke="#37D07E" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="#E8EDF3" strokeWidth="1.6" />
      <circle cx="10" cy="13" r="1.4" fill="#37D07E" />
    </svg>
  );
}

export default function Page() {
  return (
    <>
      <nav>
        <div className="wrap nav-in">
          <a className="brand" href="#top" aria-label="Deadlatch home">
            <Lock />
            deadlatch
          </a>
          <div className="nav-links">
            <a href="#stack">Stack</a>
            <a href="#why">Why open</a>
            <a href="#audit">Audit</a>
            <a href="#start">Start</a>
          </div>
          <div className="nav-right">
            <a className="npm" href={NPM.purse}>
              npm i <b>@olurabian/purse</b>
            </a>
            <a className="ghlink" href={REPO.org}>
              GitHub ↗
            </a>
          </div>
        </div>
      </nav>

      <header className="wrap hero" id="top">
        <div className="hcopy">
          <div className="eyebrow">Open runtime governance for AI agents</div>
          <h1>
            Let agents act. Decide what they&apos;re <em>allowed</em> to do, the moment they do it.
          </h1>
          <p className="lede">
            Deadlatch is an open stack of three primitives. <b>Purse</b> enforces what an agent can do,{" "}
            <b>blackbox</b> proves what it did, <b>Tripwire</b> watches for what slipped through. Install one from
            npm, or run all three.
          </p>
          <div className="flag">
            You can&apos;t trust a black box to govern your black box.
            <span>Every part is open, inspectable, and verifiable outside Deadlatch. No platform to take on faith.</span>
          </div>
          <div className="cta">
            <a className="btn primary" href="#start">
              Start with one primitive
            </a>
            <a className="btn" href="#why">
              Why it&apos;s open ↗
            </a>
          </div>
          <div className="triad-line">
            <div>
              <div className="fn">
                <b>enforce</b>
              </div>
              <div className="pkg">Purse</div>
            </div>
            <div>
              <div className="fn">
                <b>prove</b>
              </div>
              <div className="pkg">blackbox</div>
            </div>
            <div>
              <div className="fn">
                <b>watch</b>
              </div>
              <div className="pkg">Tripwire</div>
            </div>
          </div>
        </div>

        <Console />
      </header>

      <section id="stack" className="wrap">
        <div className="sec-head">
          <div className="eyebrow">Three primitives, one control loop</div>
          <h2>Prevent the wrong action. Prove what happened. Detect what slipped through.</h2>
          <p>
            Each is a small, open package you can adopt on its own. Together they close the loop around every action
            an agent takes.
          </p>
        </div>
        <div className="grid3">
          <a className="card enforce" href={REPO.purse}>
            <span className="tag">enforce · Purse ↗</span>
            <h3>The action never fires off&#8209;policy</h3>
            <div className="sub">the credential lives where the agent can&apos;t reach it</div>
            <p>
              Route every spend or tool call through Purse. It checks the action against live policy at the moment it
              happens, and a hijacked agent still cannot move money outside the rules.
            </p>
            <div className="code">
              <span className="k">const</span> d = purse.<span className="k">authorize</span>({"({ "}amount:{" "}
              <span className="s">&quot;$80.00&quot;</span>
              {" })"}
              {"\n"}
              <span className="c">// d.status → </span>
              <span className="hd">&quot;needs_approval&quot;</span>
            </div>
          </a>
          <a className="card prove" href={REPO.blackbox}>
            <span className="tag">prove · blackbox ↗</span>
            <h3>A record no one can quietly edit</h3>
            <div className="sub">hash&#8209;chained, verifiable outside the tool</div>
            <p>
              Every decision is written to a tamper&#8209;evident log. Edit, insert, or reorder a single record and
              the chain breaks. verify() names the exact record that was touched.
            </p>
            <div className="code">
              box.<span className="k">append</span>({"({ action, verdict })"}
              {"\n"}
              box.<span className="k">verify</span>() <span className="c">{"// → { ok: "}</span>
              <span className="bd">false</span>
              <span className="c">{", brokenAt: 4 }"}</span>
            </div>
          </a>
          <a className="card watch" href={REPO.tripwire}>
            <span className="tag">watch · Tripwire ↗</span>
            <h3>Catch the silent wrong turn</h3>
            <div className="sub">read&#8209;only, before a customer does</div>
            <p>
              Tripwire watches an agent run and flags the action that shouldn&apos;t have happened. It changes
              nothing, so you can put it beside a live system today.
            </p>
            <div className="code">
              tripwire.<span className="k">watch</span>(agentRun)
              {"\n"}
              <span className="c">// flags the off&#8209;policy action → </span>
              <span className="bd">alert</span>
            </div>
          </a>
        </div>
      </section>

      <section id="flow" className="wrap">
        <div className="sec-head">
          <div className="eyebrow">The control loop</div>
          <h2>One action, routed through all three.</h2>
          <p>
            The same action an agent takes, moving through enforce, prove, and watch. Purse decides it,
            blackbox records it, Tripwire watches the outcome.
          </p>
        </div>
        <FlowGraph />
      </section>

      <section id="why" className="wrap">
        <div className="why">
          <div className="big">
            You can&apos;t trust a black box to govern your <em>black box.</em>
          </div>
          <div className="points">
            <div className="pt">
              <span className="n">01</span>
              <div>
                <h4>Open, not a platform you take on faith</h4>
                <p>
                  Every primitive is source you can read and run. The thing enforcing your policy is not itself a
                  mystery box.
                </p>
              </div>
            </div>
            <div className="pt">
              <span className="n">02</span>
              <div>
                <h4>Verifiable outside the tool</h4>
                <p>
                  The audit chain checks out with plain SHA&#8209;256, on your machine, without Deadlatch in the loop.
                  Proof you hold, not proof we assert.
                </p>
              </div>
            </div>
            <div className="pt">
              <span className="n">03</span>
              <div>
                <h4>Composable, adopt one at a time</h4>
                <p>
                  Start with the one primitive you need this week. Grow into the full loop when you&apos;re ready. No
                  rip&#8209;and&#8209;replace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="now" className="wrap now">
        <div className="sec-head">
          <div className="eyebrow">Why now</div>
          <h2>The rest of the field is arriving at the same three controls.</h2>
          <p>
            This is not our claim. Independent security guidance, a US Senate draft, and this year&apos;s incident
            data all point at one loop. Enforce what an agent can do, prove what it did, watch for what slipped
            through. The sources are named so you can check them.
          </p>
        </div>

        <div className="now-grid">
          <a
            className="signal enforce"
            href="https://www.sans.org/blog/your-ai-agent-easily-confused-deputy-why-cloud-security-needs-credential-broker"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="src">SANS · practitioner ↗</span>
            <p>&quot;Your AI agent is an easily confused deputy. Cloud security needs a credential broker.&quot;</p>
            <span className="maps">
              <b>enforce</b> · a credential broker is Purse
            </span>
          </a>

          <div className="signal prove">
            <span className="src">AI AGENT Act · US Senate draft</span>
            <p>Calls for scope-limited delegation credentials, real-time revocation, and auditable records.</p>
            <span className="maps">
              <b>enforce + prove</b> · grants, revocation, receipts
            </span>
          </div>

          <a
            className="signal enforce"
            href="https://www.thefai.org/posts/human-anchored-intent-bound-delegation-for-ai-agents"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="src">HAID framework ↗</span>
            <p>Proposes binding an agent&apos;s permissions to human-declared intent, not a coarse scope.</p>
            <span className="maps">
              <b>intent-binding</b> · Purse binds the exact action
            </span>
          </a>

          <div className="signal watch">
            <span className="src">CSA + vendor reporting · 2026</span>
            <p>A majority of organizations running AI agents reported an agent-caused security incident this year.</p>
            <span className="maps">
              <b>why now</b> · the failures are already happening
            </span>
          </div>
        </div>

        <p className="now-note">
          Honest about the receipts. The AI AGENT Act is a discussion draft, not law, and the incident figures are
          vendor-reported. We link and name them so you can weigh them yourself, the same standard the audit chain
          below holds itself to.
        </p>
      </section>

      <section id="audit" className="wrap audit">
        <div className="sec-head">
          <div className="eyebrow">Evidence you can hand an auditor</div>
          <h2>The controls the new AI rules ask for. As proof you can verify yourself.</h2>
          <p>
            Human oversight, record-keeping, and monitoring. Deadlatch gives you the actual controls, open, and
            evidence an auditor can check without trusting us.
          </p>
        </div>
        <div className="map">
          <div className="row enforce">
            <div className="need">
              <div className="t">Human oversight of risky actions</div>
              <div className="fw">EU AI Act · Article 14</div>
            </div>
            <div className="arr">→</div>
            <div className="prim">
              <div className="pk">Purse</div>
              <div className="fn">enforce</div>
            </div>
          </div>
          <div className="row prove">
            <div className="need">
              <div className="t">Automatic, tamper-evident record-keeping</div>
              <div className="fw">EU AI Act · Article 12</div>
            </div>
            <div className="arr">→</div>
            <div className="prim">
              <div className="pk">blackbox</div>
              <div className="fn">prove</div>
            </div>
          </div>
          <div className="row watch">
            <div className="need">
              <div className="t">Ongoing monitoring for unsafe behaviour</div>
              <div className="fw">NIST AI RMF · Manage</div>
            </div>
            <div className="arr">→</div>
            <div className="prim">
              <div className="pk">Tripwire</div>
              <div className="fn">watch</div>
            </div>
          </div>
        </div>
        <div className="audit-note">
          No compliance checkbox to take on faith. You get the open controls and evidence your auditor can verify
          outside the tool.
          <span>
            Aligned with the record-keeping, human-oversight, and monitoring expectations of frameworks like the EU AI
            Act and the NIST AI Risk Management Framework. Deadlatch provides controls and evidence, not a
            certification.
          </span>
        </div>
      </section>

      <section id="start" className="wrap start">
        <div className="sec-head">
          <div className="eyebrow">Start with one</div>
          <h2>One npm install. No account, no platform.</h2>
          <p>Pick the primitive that solves today&apos;s problem. Each runs on its own, zero dependencies.</p>
        </div>
        <div className="steps">
          <a className="inst enforce" href={NPM.purse}>
            <div className="nm">
              <b>Purse</b>
            </div>
            <div className="fn">enforce</div>
            <div className="cmd">
              npm i <b>@olurabian/purse</b>
            </div>
          </a>
          <a className="inst prove" href={NPM.blackbox}>
            <div className="nm">
              <b>blackbox</b>
            </div>
            <div className="fn">prove</div>
            <div className="cmd">
              npm i <b>@olurabian/blackbox</b>
            </div>
          </a>
          <a className="inst watch" href={NPM.tripwire}>
            <div className="nm">
              <b>Tripwire</b>
            </div>
            <div className="fn">watch</div>
            <div className="cmd">
              npm i <b>@olurabian/tripwire</b>
            </div>
          </a>
        </div>
        <div className="foot">
          Then wire the action through it. <b>Prevent. Bear witness. Track.</b>
        </div>
      </section>

      <div className="band">
        <div className="img" />
        <div className="scrim" />
        <div className="cap">
          <div className="fn">fail closed</div>
          <div className="q">
            Closed at the <em>moment of action.</em>
          </div>
        </div>
      </div>

      <footer>
        <div className="wrap foot-in">
          <div className="foot-brand">
            deadlatch
            <div className="tag">runtime governance for AI agents</div>
          </div>
          <div className="foot-links">
            <a href="#stack">Stack</a>
            <a href="#why">Why open</a>
            <a href="#audit">Audit</a>
            <a href="#start">Start</a>
            <a href={REPO.org}>GitHub</a>
            <a href={NPM.purse}>npm</a>
          </div>
          <div className="foot-note">Open source · enforce · prove · watch · deadlatch.dev</div>
        </div>
      </footer>
    </>
  );
}
