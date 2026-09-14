# deadlatch.dev homepage edit release

Design following the audit in `2026-09-14-homepage-audit.md`. Approved in outline by ARABA on 2026-09-14
("make audit and make it better, a professional website"). This document is the detail for review.

## Goal

The site already looks like a serious developer tool. It does not yet behave like one on a phone, it hides its
strongest evidence, and it asks a visitor to choose between five doors. This release fixes the measured
problems, puts the real proof on the front page, cuts the copy by a third, and gives the visitor one path. Same
identity, same fonts, same colours, same dark ground. Nothing decorative is added and one decorative thing is
removed.

## Decisions taken

1. No 3D, no scene, no animation for its own sake. Motion on this site is data moving.
2. The visual identity stays. Geist Sans and Mono, the existing tokens, the console aesthetic.
3. The hero demo stays as the hero object and becomes lazy. It starts when seen and stops when not.
4. Real proof goes on the homepage, read live from the playground chain, with a fallback that hides rather
   than lies.
5. One primary call to action across the page, the playground. One secondary, the install.
6. The closing image band goes. Its line moves to the footer as text.

## Scope

One repository, `SaaS/deadlatch`, branch `home-edit` from main. Files, `app/page.tsx`, `components/Console.tsx`,
`components/SiteNav.tsx`, a new `components/ProofBand.tsx`, a new `lib/home/proof.ts`, `app/globals.css`,
`app/layout.tsx` if the font loader needs a change, `public/latch-band.jpg` removed, `scripts/crawl.mjs`
unchanged. Nothing under `/try`, `/app`, `/audit` or `/log` changes except the shared nav and footer.

---

## The page, section by section

### Hero

Headline unchanged. Lede trimmed to two sentences.

> Deadlatch is an open stack of three primitives. Purse enforces what an agent can do, blackbox proves what it
> did, Tripwire watches for what slipped through.

The flag stays ("You can't trust a black box to govern your black box.") with its one-line sub. Two buttons.
Primary, `Try it live`, to `/try`. Secondary, `npm i @olurabian/purse`, to `#start`. The triad line under the
buttons stays.

The console keeps its markup and behaviour. Three changes inside `Console.tsx`.

- It does not start on mount. An `IntersectionObserver` starts it the first time at least 40 percent of it is
  visible, and pauses it when it leaves the viewport, resuming on return. The pause button's own state is
  respected, a user who pressed pause stays paused.
- The first fire waits for `requestIdleCallback` with a 1,500 ms timeout, falling back to `setTimeout` where the
  API is missing.
- On append it checks only the new record, its `prev` against the last hash and its own hash. The full
  `verifyChain` runs on tamper and on reset. The tamper indicator behaves exactly as today.

### Proof band, new, directly under the hero

One row, full width, on the panel colour, three numbers and one line. Server rendered.

| Cell | Source | Rendered as |
|---|---|---|
| Receipts on the playground chain | `total` from the anchor read | `1,204 receipts` |
| Last anchor | `lastAnchor.seq`, `lastAnchor.logIndex`, `lastAnchor.at` | `anchored at seq 1,198 · Rekor entry 105663672 · 4 min ago` |
| Witnesses | fixed, from the verifier's output | `cosigned by 3 independent witnesses` |

Under the numbers, one sentence and the link. "Press a button, a real broker decides, and you get this receipt.
No sign-up." linking to `/try`.

Data path. `lib/home/proof.ts` exports `homeProof(deps)` which calls the existing `anchor()` handler from
`lib/try/handlers.ts` directly, no HTTP self-call, and maps it to `{ total, lastAnchor: { seq, logIndex, at,
logHost } | null }`. The page calls it inside a server component with Next's `revalidate` set to 60 seconds, so
production serves a cached band and the witness sees one read a minute. If the environment is not configured or
the witness does not answer, the band renders nothing. It never shows a placeholder number.

The cosigner count is a constant with a comment naming its origin, the verifier output on 2026-09-11 showed three
cosigners on every anchor. It is not fetched, because fetching it would mean running the verifier on every
request.

### Stack, three primitive cards

Unchanged in content. The section intro loses its second sentence.

### Flow

The diagram stays. The paragraph becomes one line, "Purse decides it, blackbox records it, Tripwire watches the
outcome."

### Why open

The big line becomes an `<h2>` with the same styling as the current `.big`. The three points become `<h3>`.
Copy unchanged.

### Why now

Cut from four signals to two, SANS and the Senate draft. The HAID card and the CSA card go. The "honest about the
receipts" note becomes one sentence, "The Senate text is a discussion draft, not law, and it is linked so you
can read it."

### Compliance map

Unchanged. It is the section a buyer with an auditor reads. The free audit link stays inside it, as the
section's own action, styled as the existing `ghlink`.

### Start

Unchanged, three install cards. The closing line under them, "Then wire the action through it. Prevent. Bear
witness. Track." stays.

### Band

Removed, with `public/latch-band.jpg`. The line "Closed at the moment of action." moves into the footer above
the brand, in the mono eyebrow style, no image.

### Footer

Links become Try, Stack, Why open, Audit, Log, App, GitHub, npm, and one more, "The Stack" to
`https://arabastack.com`, with the note line reading "Open source · enforce · prove · watch · 25 dated ships".
The count is a constant with a comment, updated by hand when The Stack changes.

---

## Nav

`components/SiteNav.tsx`. Links, in order, Try, Stack, Why open, Audit, Log, App. The App link gets
`prefetch={false}`, which removes both console errors. At 900 px and below the links collapse behind a button
labelled Menu with `aria-expanded`, opening a vertical list in the same panel colour under the bar. The npm pill
stays hidden on phones as now. Closing the menu on link click and on Escape.

## Fonts and layout shift

If the fonts are loaded through `next/font`, confirm `adjustFontFallback` is on, which is the default, and check
whether the lede's shift comes from the console mounting instead. If they are declared by hand in CSS, add
`size-adjust`, `ascent-override` and `descent-override` on the fallback face so the swap does not move text.
Acceptance is measured, CLS under 0.05 on mobile.

## Copy rules

No colons and no em dashes in prose the visitor sees, inline code exempt. No counterparty names. The word count
lands near 650. Every sentence that survives says something a developer, a buyer or an auditor needs.

## Performance and accessibility targets

Measured with Lighthouse 12 on the deployed site, mobile preset, after release.

- Performance 90 or better, TBT under 200 ms, LCP under 2.5 s, CLS under 0.05.
- Accessibility 100. Best practices 100 with zero console errors. SEO 100.
- Transfer under 400 KiB. Desktop at or above its current numbers.

## Tests

- `lib/home/proof.ts` against an injected `anchor` result, the mapping, the null case, the thrown case.
- The nav's menu state in a small component test if the repository has one pattern for it, otherwise the live
  check covers it.
- The existing 73 tests stay green. The crawl stays unchanged, every public page 200 with its title.
- Live gate. Lighthouse mobile and desktop before and after, recorded in the ledger. A phone-width check that
  the menu opens and all six links are reachable. A check that the console does not start until scrolled into
  view, by reading its tick counter before and after scrolling. Zero console errors on load.

## Release

Branch `home-edit`, the protected flow, `vercel deploy --prod`, then the live gate above, then screenshots at
desktop and phone width into Downloads, then a Stack entry and the ledger.

## Non-goals

- No new visual identity, no light theme, no new fonts, no new colours.
- No 3D and no animation beyond the existing console and the flow diagram as they are.
- No new pages. No change to the content of `/try`, `/app`, `/audit` or `/log`.
- No change to the Clerk instance. The prefetch fix removes the errors on its own.
- No fetching of the cosigner count on request.
