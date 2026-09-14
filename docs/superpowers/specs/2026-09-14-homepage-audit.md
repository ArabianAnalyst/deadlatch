# deadlatch.dev homepage audit

Measured 2026-09-14 against the production site at main 7e2d664. Lighthouse 12, Chrome 147 headless, one run
each. The raw reports are in the session scratchpad, the numbers below are copied from them.

## Scores

| | Mobile | Desktop |
|---|---|---|
| Performance | 68 | 98 |
| Accessibility | 98 | 98 |
| Best practices | 100 | 96 |
| SEO | 100 | 100 |
| Largest Contentful Paint | 3.1 s | 0.6 s |
| Total Blocking Time | 1,030 ms | 10 ms |
| Cumulative Layout Shift | 0.079 | 0 |
| Total transfer | 498 KiB | 504 KiB |
| Main-thread work | 4.7 s | |

The desktop score is what a laptop visitor gets and it is fine. The mobile score is what a phone gets and it is
not. A second of blocked main thread on a phone is the difference between a site that feels engineered and one
that feels heavy.

## Findings, with the cause and the fix

### 1. Mobile blocking, 1,030 ms

Main-thread breakdown on mobile is 1,619 ms style and layout, 1,405 ms other, 1,099 ms script evaluation. The
long tasks are 524 ms, 290 ms and 150 ms attributed to the page's own inline script, plus 371 ms in the 44 KiB
chunk that carries the hero console.

Cause. `components/Console.tsx` starts on mount, fires a spend every 2,300 ms, appends a SHA-256 record, then
runs `verifyChain` over the whole chain, re-hashing every record, and re-renders the console on every tick. It
runs whether or not the console is in the viewport, and it runs on a phone where the console is below the
fold. It is honest work, the hashing is real, but it is the wrong work to do at page load.

Fix. Start the demo on first intersection, not on mount. Pause it when it leaves the viewport. Verify
incrementally on append (check the new record against the previous hash) and run the full `verifyChain` only
on tamper, where it is the point. Defer the first fire behind `requestIdleCallback`. The demo behaves the same
to a viewer and costs nothing until they look at it.

### 2. Largest Contentful Paint, 3.1 s on mobile

The LCP element is the `<h1>`. Text, not an image. It is late because the main thread is busy (finding 1) and
because the fonts swap in. Fixing finding 1 moves most of this. The rest is the font path, below.

### 3. Layout shift, 0.079 on mobile

The one shifting element is `<p class="lede">`. That is the Geist fallback swapping to Geist Sans. The fix is
a size-adjusted fallback, which `next/font` does automatically when it is the loader, or a manual
`size-adjust` on the fallback face if the fonts are declared by hand. Target under 0.05.

### 4. Two console errors on every load

Best practices 96 on desktop is this one item. Next prefetches the nav's `/app` link, `/app` redirects to the
Clerk development instance on `accounts.dev`, and the cross-origin preflight is refused. A visitor who opens
DevTools on a site about trust sees two red lines before reading a word. Fix, `prefetch={false}` on that
link. The Clerk production instance is a separate decision and makes this moot when it lands.

### 5. Heading order fails accessibility

The "why" section skips a level. Its title is a `<div class="big">` and its three points are `<h4>`, so the
document goes h2, h4. Fix, the title becomes an `<h2>` styled as it is now, the points become `<h3>`. That takes
accessibility to 100 on both.

### 6. 135 KiB for a decorative image

`latch-band.jpg` is the only image on the page and the only asset over 10 KiB. Lighthouse counts it twice,
offscreen and not next-gen, 132 KiB and 79 KiB of estimated savings. It sits in a closing band above the
footer. It is a photographic vault texture, which is the aesthetic ARABA rejected elsewhere. Fix, remove the
band and keep its one line of copy as the footer's closing line. Total transfer falls under 400 KiB.

### 7. Unused JavaScript, 57 KiB

Two chunks ship more than half unused, 32 KiB of 60 and 24 KiB of 64. Clerk is not among them, its client is
not on the homepage at all, which I checked against the served HTML. This is Next runtime and the console.
Finding 1 shrinks the console's share. The rest is the framework floor and not worth chasing.

### 8. The mobile nav drops six links

At 900 px and below `.nav-links` is `display: none` with no menu behind it. A phone shows the wordmark and
GitHub. Try, Stack, Why open, Audit, Log and App are unreachable from the header. Fix, a disclosure button that
opens the same six links.

### 9. Four calls to action

Start with one primitive, Why it's open, Try, App. And the free audit inside the compliance section. Five doors
in the first screen and a half. Fix, one primary, Try it live, and one secondary, the install. Everything else
stays reachable but stops competing.

### 10. The best evidence is not on the page

The playground at `/try` gives a stranger a real hash-chained receipt in about eight seconds, on a chain
anchored in a public transparency log and cosigned by three independent witnesses. The homepage never says so.
The hero shows a simulation. The real numbers, records on the chain, the last anchor and its log entry, exist
live at `/api/try/anchor` and cost one cached read to show.

### 11. Length and repetition

953 words. The three primitives are named in the hero lede, in the three cards, in the flow section's
paragraph, in the compliance map and in the install cards. The "why now" section carries four sourced quotes
and a paragraph about the quotes. A developer skims all of it. Target about 650 words with nothing lost that a
buyer or an auditor needs.

## What is already right and stays

- The headline, the one accent word, the lede's structure.
- Geist Sans and Geist Mono, the dark ground, the green, amber and red tokens.
- The live console as the hero object, once it stops running unseen.
- The three primitive cards with real code, and the compliance map, which is the section a buyer with an
  auditor actually reads.
- No images, no canvas, nine scripts, no horizontal overflow at 390 px.

## Targets for the edit release

| Metric | Now (mobile) | Target |
|---|---|---|
| Performance | 68 | 90 or better |
| Total Blocking Time | 1,030 ms | under 200 ms |
| Largest Contentful Paint | 3.1 s | under 2.5 s |
| Cumulative Layout Shift | 0.079 | under 0.05 |
| Accessibility | 98 | 100 |
| Best practices | 96 desktop | 100, zero console errors |
| Transfer | 498 KiB | under 400 KiB |
| Words | 953 | about 650 |

Desktop stays at or above its current numbers.

## After, measured 2026-09-14 on main 137b5fc

Same method as above, Lighthouse 12, Chrome 147 headless, against the deployed site. Mobile was run twice because
Lighthouse mobile varies run to run.

| | Mobile, run 1 | Mobile, run 2 | Desktop | Target |
|---|---|---|---|---|
| Performance | 94 | 96 | 99 | 90 or better |
| Accessibility | 100 | 100 | 100 | 100 |
| Best practices | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| Largest Contentful Paint | 2.8 s | 2.7 s | 0.6 s | under 2.5 s |
| Total Blocking Time | 150 ms | 80 ms | 0 ms | under 200 ms |
| Cumulative Layout Shift | 0 | 0 | 0 | under 0.05 |
| Total transfer | 307 KiB | 307 KiB | 384 KiB | under 400 KiB |
| Console errors | 0 | 0 | 0 | 0 |

Every target met except mobile LCP, which misses by 0.2 to 0.3 s. The element is still the `<h1>`. The breakdown on
run 2 was 931 ms to first byte and 1,800 ms of render delay under simulated 4G, with no load delay and no load time,
so the remaining cost is the render-blocking path (the stylesheet and the font) rather than bytes or script. That is
the next lever, and it was not in this release's scope.

### Words

The 953 above was the whole rendered route. Measured the same way after, the route is 923, because the route also
carries the nav (twice, one set per breakpoint), the console's labels, the proof band's live numbers and about 93
words of hidden screen-reader text the flow diagram's library renders. Measured on the page's own copy with one
method on both versions, the copy went from 798 words to 655.

### Behaviour gates on the live site

- Console ticks, viewport set before navigation. 390 × 844: 0 before scrolling into view, 3 after. 360 × 640: 0 and 3.
  Desktop 1440 × 900, where the console is in view at load: 3.
- Phone menu at 390: Try, Stack, Why open, Audit, Log, App; Escape closes it. Desktop bar: the same six.
- Proof band, live: 51 receipts on the playground chain, seq 50 anchored in log2025-1.rekor.sigstore.dev, entry
  106332328, 2 days ago, 3 witnesses. Its top border is 0, so the section hairline no longer doubles the panel border.
- No horizontal overflow at 360. Console log on load: zero messages, no `accounts.dev` error.
- Screenshots in Downloads, `deadlatch-home-after.png` and `deadlatch-home-after-mobile.png`.
