<div align="center">
  <img src="assets/logo.png" width="132" alt="Deadlatch" />
  <h1>Deadlatch</h1>
  <p><b>The open runtime governance stack for AI agents.</b></p>
  <p>Enforce what an agent can do. Prove what it did. Watch what slipped through.</p>
  <p>
    <a href="https://www.npmjs.com/package/@olurabian/purse"><img src="https://img.shields.io/npm/v/@olurabian/purse?style=for-the-badge&label=purse&color=37D07E" alt="purse on npm" /></a>
    <a href="https://www.npmjs.com/package/@olurabian/blackbox"><img src="https://img.shields.io/npm/v/@olurabian/blackbox?style=for-the-badge&label=blackbox&color=F2B33D" alt="blackbox on npm" /></a>
    <a href="https://www.npmjs.com/package/@olurabian/tripwire"><img src="https://img.shields.io/npm/v/@olurabian/tripwire?style=for-the-badge&label=tripwire&color=FB5B4B" alt="tripwire on npm" /></a>
    <a href="https://deadlatch.dev"><img src="https://img.shields.io/website?url=https%3A%2F%2Fdeadlatch.dev&style=for-the-badge&label=deadlatch.dev&up_color=1B34E0&up_message=live" alt="deadlatch.dev" /></a>
  </p>
  <p><sub><b>enforce</b> &nbsp;·&nbsp; <b>prove</b> &nbsp;·&nbsp; <b>watch</b> &nbsp;·&nbsp; three small packages, one control loop</sub></p>
</div>

You can't trust a black box to govern your black box. Deadlatch is three open primitives you can read, run, and verify yourself. Adopt one on its own, or run all three around every action an agent takes.

## The stack

|  | Package | Install | What it does |
|--|---------|---------|--------------|
| **enforce** | [Purse](https://github.com/ArabianAnalyst/purse) | `npm i @olurabian/purse` | Checks each spend or tool call against live policy at the moment it fires. A hijacked agent still can't move money outside the rules. |
| **prove** | [blackbox](https://github.com/ArabianAnalyst/blackbox) | `npm i @olurabian/blackbox` | Writes every decision to a hash-chained log. Edit one record and the chain breaks. `verify()` names the record that was touched. |
| **watch** | [Tripwire](https://github.com/ArabianAnalyst/tripwire) | `npm i @olurabian/tripwire` | Read-only scan that runs an agent against your rules and adversarial inputs, then flags every action that completed but broke one. |

Every package is zero-dependency, typed, and MIT licensed. The audit chain checks out with plain SHA-256, on your machine, without Deadlatch in the loop.

## This repo

The site behind [deadlatch.dev](https://deadlatch.dev). Next.js (App Router), deployed on Vercel. The homepage runs a live in-browser demo backed by a real policy engine and a genuine SHA-256 hash chain, no mockups.

```bash
npm install
npm run dev
```

## Watch

The hosted side of the Deadlatch monitor lives under `/app`. See `docs/watch.md` for what it holds, what the API accepts, and the six environment variables it needs. The public pages need none of them.

## Links

- Live site, https://deadlatch.dev
- Purse (enforce), https://github.com/ArabianAnalyst/purse
- blackbox (prove), https://github.com/ArabianAnalyst/blackbox
- Tripwire (watch), https://github.com/ArabianAnalyst/tripwire
