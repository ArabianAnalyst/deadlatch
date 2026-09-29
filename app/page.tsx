import localFont from "next/font/local";
import Link from "next/link";
import Console from "@/components/Console";
import ControlLoop from "@/components/ControlLoop";
import ProofBand from "@/components/ProofBand";
import { db } from "@/lib/db/client";
import { homeProof } from "@/lib/home/proof";

/**
 * The italic display face. Declared here rather than in the root layout because only `/`
 * (`.hero h1 em`, `.why .big em`) and `/audit` (`.af-hero h1 em`, declared in its own page)
 * paint an italic serif, and a root declaration preloads 22 KiB on /try, /app, /log and /sign-in for nothing.
 * The variable is applied to the page's outermost element, so it exists only on `/`.
 */
const InstrumentSerifItalic = localFont({
  src: [{ path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" }],
  variable: "--font-serif-italic",
  display: "optional",
  preload: true,
  adjustFontFallback: "Times New Roman",
});

/** The proof band's numbers refresh at most once a minute, so the witness sees one read a minute from this page. */
export const revalidate = 60;

/** Updated by hand when The Stack changes. */
const SHIPS = 26;

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

export default async function Page() {
  const proof = await homeProof({ db, fetch });
  return (
    <div className={InstrumentSerifItalic.variable}>
      <header className="wrap hero" id="top">
        <div className="hcopy">
          <div className="eyebrow">Open runtime governance for AI agents</div>
          <h1>
            Let agents act. Decide what they&apos;re <em>allowed</em> to do, the moment they do it.
          </h1>
          <p className="lede">
            Deadlatch is an open stack of three primitives. <b>Purse</b> enforces what an agent can do,{" "}
            <b>blackbox</b> proves what it did, <b>Tripwire</b> watches for what slipped through.
          </p>
          <div className="flag">
            You can&apos;t trust a black box to govern your black box.
            <span>Every part is open, inspectable, and verifiable outside Deadlatch. No platform to take on faith.</span>
          </div>
          <div className="cta">
            <Link className="btn primary" href="/try">
              Try it live
            </Link>
            <a className="btn" href="#start">
              npm i @olurabian/purse
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

      <ProofBand proof={proof} />

      <section id="stack" className="wrap">
        <div className="sec-head">
          <div className="eyebrow">Three primitives, one control loop</div>
          <h2>Prevent the wrong action. Prove what happened. Detect what slipped through.</h2>
          <p>Each is a small, open package you can adopt on its own.</p>
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
          <p>Purse decides it, blackbox records it, Tripwire watches the outcome.</p>
        </div>
        <ControlLoop />
      </section>

      <section id="why" className="wrap">
        <div className="why">
          <h2 className="big">
            You can&apos;t trust a black box to govern your <em>black box.</em>
          </h2>
          <div className="points">
            <div className="pt">
              <span className="n">01</span>
              <div>
                <h3>Open, not a platform you take on faith</h3>
                <p>
                  Every primitive is source you can read and run. The thing enforcing your policy is not itself a
                  mystery box.
                </p>
              </div>
            </div>
            <div className="pt">
              <span className="n">02</span>
              <div>
                <h3>Verifiable outside the tool</h3>
                <p>
                  The audit chain checks out with plain SHA&#8209;256, on your machine, without Deadlatch in the loop.
                  Proof you hold, not proof we assert.
                </p>
              </div>
            </div>
            <div className="pt">
              <span className="n">03</span>
              <div>
                <h3>Composable, adopt one at a time</h3>
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
          <p>Independent security guidance and a US Senate draft point at the same loop.</p>
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
        </div>

        <p className="now-note">
          The Senate text is a discussion draft, not law. Both sources are named so you can weigh them yourself.
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
          <p>
            <a className="ghlink" href="/audit">
              Run the free audit on your own setup ↗
            </a>
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
          <span>Aligned with the EU AI Act and the NIST AI Risk Management Framework, not a certification.</span>
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

      <footer>
        <div className="wrap foot-in">
          <div className="foot-close">
            Closed at the <em>moment of action.</em>
          </div>
          <div className="foot-brand">
            deadlatch
            <div className="tag">runtime governance for AI agents</div>
          </div>
          <div className="foot-links">
            <Link href="/try">Try</Link>
            <a href="#stack">Stack</a>
            <a href="#why">Why open</a>
            <Link href="/audit">Audit</Link>
            <Link href="/log">Log</Link>
            <Link href="/app" prefetch={false}>
              App
            </Link>
            <a href={REPO.org}>GitHub</a>
            <a href={NPM.purse}>npm</a>
            <a href="https://arabastack.com">The Stack</a>
          </div>
          <div className="foot-note">Open source · enforce · prove · watch · {SHIPS} dated ships</div>
        </div>
      </footer>
    </div>
  );
}
