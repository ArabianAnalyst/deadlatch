# Site pass, inner pages, /try resilience and the /audit rebuild

**Date:** 2026-09-29
**Branch:** `site-pass` from main `ff97604`
**Approved by:** ARABA, "Go" on 2026-09-29 for the build. Release is a second Go on the pull request.
**Builds on:** `2026-09-22-dark-editorial-skin-design.md`. Every token, font rule and gate there still binds.

## Problem

1. Only the homepage wears the dark editorial skin. `/try`, `/audit`, `/log`, the log posts and the 404 still use the bold Geist headline and leftover green and amber accents, so the site reads as two products one click in.
2. `/try` is the main call to action and it failed silently for visitors. Both the press buttons and the Watch panel depend on Neon, and when Neon refused (quota, HTTP 402, since late September) the buttons returned 500 and Watch said "flags unavailable", with the cause swallowed. The page also prints "9043 minutes ago", wraps a Rekor host across five lines, and breaks the "Point your own broker" pill across three.
3. `/audit` hides its verdict behind 30 fields and a button at the bottom of a 4,122 px page, although the engine already runs in the browser.
4. `/log` has three posts, the last from 8 September.

## Decisions

### D1. The skin on every inner page

| Selector | Change |
|---|---|
| `.log-hd h1` | `font-family: var(--serif)`, `font-weight: 400`, `font-size: clamp(2.4rem, 5vw, 3.6rem)`, `line-height: 1.02`, `letter-spacing: -0.01em` |
| `.log-article-head h1` | same serif treatment, `font-size: clamp(2.2rem, 4.6vw, 3.2rem)` |
| `.prose h2` | `font-family: var(--serif)`, `font-weight: 400`, one step larger than today |
| `.try .try-strip` | sans (`var(--sans)`) instead of mono, border-left `var(--accent)` instead of `var(--hold)` |
| `.log-arrow`, `.prose a`, `.prose a:hover`, `.prose li::before` | `--allow` / `--allow-ln` become `--accent`; `.prose a` keeps an underline (`text-decoration: underline; text-underline-offset: 3px`) |
| `.logwrap` | unchanged at 760 px for reading pages; a new `.logwrap.wide { max-width: 1120px }` used by `/try` and `/audit` |

Semantic greens stay green: decision chips, `ok` states, the enforce leg. The brand-green test in `test/home-tokens.test.ts` extends to the selectors above.

### D2. /try stops depending on the database to work

- **Rate limiter fails open.** In `lib/try/handlers.ts`, when `take()` throws, the handler logs `console.error("try limiter unavailable", cause)` and lets the call through. The playground broker runs a mock rail with its own caps, so an unlimited visitor can at worst exhaust the broker's own daily cap, which it already refuses. Cost if wrong: a burst of demo traffic reaches the mock broker unthrottled while the database is down.
- **Watch pauses instead of failing.** `flags()` catches, logs `console.error("try flags unavailable", cause)`, and returns `200` with `{ paused: true, monitor: { state: "never", cursorSeq: null }, flags: [] }`. `Playground.tsx` shows "Watch is paused. The monitor is still running, its flags will show here when the dashboard is back." instead of an error. No red console error on page load.
- **Ages read as ages.** `Playground.tsx` uses `minutesAgo` from `lib/home/format.ts` instead of inline minute arithmetic.
- **Layout.** `/try` uses `.logwrap.wide`. Long hosts and hashes use `overflow-wrap: anywhere` inside their own line, not the column. The "Point your own broker at this" pill becomes a plain link with an arrow.

### D3. /audit rebuilt from the comp

The reference is `docs/superpowers/specs/2026-09-29-audit-comp.html` (published as an artifact on 2026-09-28 and approved in conversation). `components/AuditForm.tsx` is rewritten to match it in React:

- Questions in an accordion, one open at a time, each with an `answered` / `unknown` chip, a progress count and bar.
- A sticky live verdict beside the questions on desktop, recomputed with `useMemo(() => score(toIntake(answers)))` on every change. Posture sentence, eight dimension cells coloured by verdict, the two threats, blast radius, shortest path, first unknown question.
- "Load an example agent" (fills from `exampleIntake()`) and "Start blank". The page opens with the example loaded and clearly labelled as an example.
- Notes collapsed behind "+ Add a note". "Unknown, ask me later" as the empty option of every select.
- Trust line, "Runs entirely in your browser. Nothing you type is sent anywhere." True today and it must stay true, the component makes no network call.
- "Copy report as markdown" and "Save as HTML" both kept.
- On phones the verdict follows the questions and a compact verdict bar is fixed to the bottom with the safe-area inset.
- The existing `toIntake` mapping is kept exactly, it is the contract with `@olurabian/audit`.

### D4. Two new log posts

`content/log/green-for-21-days.md` and `content/log/four-states-of-a-control.md`, dated 2026-09-29, adapted from `Social Content/Posts/2026-09-24-green-for-21-days.md` and `2026-09-26-four-states-of-a-control.md`. Long form, a little more technical than the LinkedIn versions, same facts. No colons or em dashes in the prose. Frontmatter as the existing posts, `title`, `date`, `description`.

## Non goals

- No change to the homepage, `/app`, `/sign-in` or the API contracts other than the two handler behaviours in D2.
- No new runtime dependency.
- The Neon plan itself.

## Gates

Measured on the production deploy after release, Lighthouse 12 mobile, same method as 2026-09-22.

| Route | Today | Gate |
|---|---|---|
| All inner routes, accessibility, best practices, SEO | 100, 96 on /try, 100 | 100, 100, 100 |
| All inner routes, CLS | 0 | 0 |
| `/try` weight | 289 KiB | ≤ 300 KiB |
| `/audit` weight | 292 KiB | ≤ 310 KiB, the engine was already shipped |
| `/log` weight | 299 KiB | ≤ 300 KiB |
| Console errors on load, all routes | 1 on /try (the 502) | 0 |
| `/try` press buttons with the database refusing | 500 | the broker answers |

## Tests

- `test/try-handlers.test.ts` gains cases for a throwing limiter (call proceeds, error logged) and a throwing flags query (200 with `paused: true`).
- `test/home-tokens.test.ts` brand-green list extends to the D1 selectors, and asserts the serif on `.log-hd h1` and `.log-article-head h1`.
- `test/audit-form.test.ts`, new, renders `AuditForm` with `react-dom/server` and asserts the example posture sentence is present on first render, eight dimension cells exist, and no `fetch` appears in the component source.
- `test/log-posts.test.ts`, new, asserts both new posts parse with title, date and description, and their bodies contain no colon followed by a space outside code and URLs, and no em dash.
