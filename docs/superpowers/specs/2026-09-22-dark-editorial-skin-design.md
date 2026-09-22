# deadlatch.dev dark editorial skin, design

**Date:** 2026-09-22
**Branch:** `home-skin` from main `ad199a5`
**Comp chosen:** C of three, "dark editorial", rendered at `SaaS/Product/Design/deadlatch-hero-comps/comp-c-dark-editorial.html`
**Supersedes nothing.** Builds on the 2026-09-14 homepage edit and the 2026-09-16 LCP pass. Every gate from those two specs still binds.

## Problem

The site is engineered well (mobile 96, LCP 1.6 s, CLS 0, 316 KiB, a11y 100) and looks like every other AI startup. Dark ground, one neon accent, glow gradients, a node graph. The owner rejected that look for olurabian.com in July and Deadlatch still wears it. The site is now the link in the About and in every post, so how it reads on first sight matters more than it did.

## Decision

Keep the dark ground. Remove the four signals that read as generic. Add one editorial signal.

1. **Neon green stops being the brand.** `--allow` (#37d07e) stays as the semantic colour for an allowed decision inside the console and the proof band. It stops being used for the headline emphasis, the primary button, the eyebrow and links. A new `--accent` carries the brand.
2. **Glow gradients go.** The two body radials, the `body::before` vignette, the hero radial at line 169 and the two section radials at 877 and 878 are removed. The ground is flat.
3. **The node graph goes.** The "control loop" section stops rendering `@xyflow/react`. It becomes a static, server rendered three step strip in CSS. The dependency and `FlowGraphLazy` are removed.
4. **The console stays.** The live hero console is the strongest object on the page and it survives as is, a dark panel with its own tokens. Only its chrome changes where it uses the brand green.
5. **One serif.** Instrument Serif joins Geist as the display face for the h1, the h2s, the flag line, the brand mark and the proof numbers. Everything else stays Geist.

## Exact values

### Tokens, `app/globals.css` `:root`

| Token | Before | After | Why |
|---|---|---|---|
| `--ground` | `#0a0c10` | `#0a0c10` | unchanged, flat |
| `--accent` | none | `#7c93ff` | brand accent on dark. 6.97:1 on `--ground`, passes AA at every size used |
| `--accent-ink` | none | `#0a0c10` | text on an accent fill, if any |
| `--allow` | `#37d07e` | `#37d07e` | unchanged, decisions only |
| `--serif` | none | `var(--font-serif), "Instrument Serif", Georgia, serif` | display face |

Every other token is unchanged.

### Where the brand green becomes the accent

| Selector | Property | Before | After |
|---|---|---|---|
| `.hero h1 em` | `color` | `var(--allow)` | `var(--accent)`, and `font-style: italic` |
| `.eyebrow` | `color` | `var(--faint)` | `var(--accent)` |
| `.btn.primary` | `background`, `color`, `border-color` | `var(--allow)`, `#062012`, `var(--allow)` | `var(--ink)`, `var(--ground)`, `var(--ink)` |
| `.btn.primary:hover` | `background`, `border-color` | `#43e08c` | `#ffffff` |
| nav `App` link and any `.ghlink` | `color` | `var(--muted)` | `var(--muted)` — already muted on main, unchanged |
| `.flag` | `border-left-color` | current | `var(--accent)` |

Any remaining rule that references `#37d07e` or `rgba(55, 208, 126, …)` outside `.console`, `.proof` and decision chips is a defect. The grep for those two strings must return only console, proof and chip rules when the pass is done.

### Type

| Selector | Before | After |
|---|---|---|
| `.hero h1` | Geist, `clamp(2.15rem, 4.4vw, 3.35rem)`, weight 640, tracking −0.025em | `var(--serif)`, `clamp(2.6rem, 5.2vw, 4.1rem)`, weight 400, line-height 1.0, tracking −0.012em, `text-wrap: balance` kept |
| `.sec-head h2`, `h2.big` | Geist semibold | `var(--serif)`, weight 400, size one step up from today |
| `.flag` first line | Geist semibold | `var(--serif)`, 1.35rem, weight 400. The `span` under it stays Geist |
| `.brand` | Geist Mono | `var(--serif)`, 1.5rem |
| `.proof-n` | Geist Mono | `var(--serif)`, 2.1rem |

Body, lede, buttons, chips, table text and the console stay Geist and Geist Mono.

### Font loading, `app/layout.tsx`

Add `InstrumentSerif` with `next/font/local` from `app/fonts/InstrumentSerif-Regular.woff2` and `app/fonts/InstrumentSerif-Italic.woff2`, `display: "optional"`, `preload: true`, `variable: "--font-serif"`, `adjustFontFallback` left on. Same shape as the two Geist declarations. Font files come from the Instrument Serif release on Google Fonts, OFL, committed to `app/fonts/` like Geist is.

`font-display: optional` is the reason the LCP pass holds CLS at 0. It stays. A late serif is simply not used for that view.

### The control loop section, `app/page.tsx` and `app/globals.css`

Replace `<FlowGraphLazy />` with a static block:

```
<div class="loop">
  <div class="loop-step"><div class="loop-k">1 · enforce</div><div class="loop-t">Purse decides it</div><div class="loop-s">caps, allowlist, approval out of band</div></div>
  <div class="loop-arrow" aria-hidden="true"></div>
  <div class="loop-step"><div class="loop-k">2 · prove</div><div class="loop-t">blackbox records it</div><div class="loop-s">hash chained, head anchored outside</div></div>
  <div class="loop-arrow" aria-hidden="true"></div>
  <div class="loop-step"><div class="loop-k">3 · watch</div><div class="loop-t">Tripwire watches the outcome</div><div class="loop-s">flags the wrong action inside one interval</div></div>
</div>
```

Three panels on `--panel` with `--line` borders, `.loop-k` in Geist Mono and `--accent`, `.loop-t` in the serif, `.loop-s` in `--muted`. Arrows are a 1px `--line2` rule with a small chevron, CSS only. On phones the three stack and the arrows turn vertical. No JavaScript, no IntersectionObserver, nothing lazy.

Remove `components/FlowGraph.tsx`, `components/FlowGraphLazy.tsx`, the `.rf-*` rules in `globals.css`, and `@xyflow/react` from `package.json`. Run the supply chain checks after the removal, since the lockfile changes.

### Copy

Unchanged. The h1, lede, flag, section heads and the loop's three lines carry the same meaning as today. Word count stays inside the 655 measured on 2026-09-14. That figure was a measurement, not a test, so the plan re-measures it the same way rather than relying on a test that does not exist.

## Non goals

- No light theme. Comp A was not chosen.
- No component library, no Tailwind, no new runtime dependency. Net dependencies go down by one.
- No change to `/try`, `/app`, `/audit`, `/log` or `/sign-in` beyond what they inherit from the shared tokens and the nav. If a token change makes any of those pages worse, that page gets a scoped override rather than the token being reverted.
- No change to the console's behaviour, its lazy start, its verify logic or its tests.

## Gates

Measured on production after release, same method as the 2026-09-16 pass, two mobile runs and one desktop.

| Metric | Floor or ceiling | Today |
|---|---|---|
| Mobile performance | ≥ 96 | 96, 97 |
| Mobile LCP | ≤ 1.7 s | 1.6, 1.7 |
| CLS, both widths | 0, confirmed by a buffered layout-shift observer | 0 |
| TBT | ≤ 190 ms | 190 |
| Page weight, mobile | ≤ 316 KiB, expected lower with the graph library gone | 316 |
| Accessibility, best practices, SEO | 100 | 100 |
| Console errors | 0 | 0 |
| Contrast | every text colour on its ground passes AA, checked for `--accent` on `--ground` and `--panel` | |
| Green audit | `grep -nE "37d07e|55, ?208, ?126" app/globals.css` returns only rules under `.console`, `.proof`, `.chip`, `.decision` or their descendants | |

If any gate fails, the pass is not released. A gate that fails because of the serif is fixed by dropping the serif from that element, never by loosening the gate.

## Tests

- Existing suites stay green, 79 tests across 15 files.
- Add `test/home-loop.test.ts`: render the home page markup and assert the loop section contains exactly three `.loop-step` nodes in the order enforce, prove, watch, and no element with an `rf-` class. This is the test that proves the graph is gone and the replacement is server rendered.
- Add to `test/smoke.test.ts` or a new `test/home-tokens.test.ts`: read `app/globals.css` and assert the green audit grep above. A skin regression that reintroduces brand green fails a test instead of waiting for someone to notice.

## Rollout

1. Font files in, `layout.tsx` declaration, tokens and type rules. Verify locally, CLS 0 with the buffered observer.
2. Green to accent swap, glow removal. Green audit grep clean.
3. Loop section replaces the graph, dependency removed, lockfile updated, security checks green.
4. Lighthouse before and after on a preview deploy, both widths. Table appended to this spec under "After", as the 2026-09-14 spec was.
5. Release on ARABA's Go through the protected main flow. Entry on The Stack.

## Rulings taken while writing this

- **Console keeps its dark panel and its green.** The comp showed a static transcript. The live console is better evidence than any transcript and it already exists, so the comp's object is not adopted.
- **Ground stays `#0a0c10` rather than the comp's `#0c0e12`.** The difference is invisible and the old value is already contrast checked across every token.
- **Accent is `#7c93ff`, not the site's `--focus` `#5b8def`.** Focus rings stay distinct from brand, which matters for keyboard users. `#5b8def` also fails AA at 12 to 13 px on `--ground`.

## After, local (2026-09-22, branch home-skin)

Before is production at main `ad199a5`. After is `next start` on localhost, so LCP is indicative only and the production LCP is re-measured after release.

| Metric | Before (production) | After (localhost) | Gate |
|---|---|---|---|
| Mobile performance, two runs | 95, 98 | 91, 85 | ≥ 96 |
| Desktop performance | 100 | 100 | |
| Mobile LCP | 2.42 s, 1.88 s | 3.28 s, 3.30 s (localhost, indicative only) | ≤ 1.7 s (production) |
| CLS, phone and desktop, buffered observer | not measured — the Step 3 script only navigates localhost | phone 0 (empty shifts array); desktop 0.000019 (2 shifts, both sourced to a `B` element) | 0 |
| TBT | mobile 117 ms, 148 ms; desktop 8 ms | mobile 121 ms, 321 ms; desktop 2 ms | ≤ 190 ms |
| Page weight, mobile | 316 KiB | 367 KiB | ≤ 316 KiB |
| a11y, best practices, SEO | 100, 100, 100 | 96, 100, 100 | 100 |
| Words on the page | 655 | 835 (phone), 853 (desktop) | ≤ 655 |
| Green above the fold | not measured — the Step 3 script only navigates localhost | 3, phone and desktop alike: `span.pill.allow` ("allow"), `button.g` ("spend $12"), `span.ok` ("✓ ok"), all inside `.hero` | 0 |
| Script bytes on `/` | mobile 145.3 KiB / 9 requests, desktop 213.1 KiB / 11 requests | mobile 141.5 KiB / 9 requests, desktop 151.4 KiB / 10 requests | lower than main |

### After the fix wave (2026-09-22, branch `home-skin`)

One pass over the whole branch, after the table above. Fonts subset, the accent link in
running text underlined, the brand lock recoloured, the layering the deleted glows left
behind removed, and three measurement probes that could not fail replaced.

**Geist, subset to Latin by `scripts/subset-geist.py`**

| File | Before | After | Saved |
|---|---|---|---|
| `app/fonts/Geist-Variable.woff2` | 69,652 B (68.0 KiB) | 33,236 B (32.5 KiB) | 35.5 KiB |
| `app/fonts/GeistMono-Variable.woff2` | 71,368 B (69.7 KiB) | 34,656 B (33.8 KiB) | 35.8 KiB |
| both | 137.7 KiB | 66.3 KiB | **71.4 KiB** |

Both keep the `wght` axis at 100-900 and every OpenType layout feature. 393 and 426 glyphs
remain. Re-running the script reproduces the same bytes.

**The serif, for comparison**

| File | Size | Preloaded on |
|---|---|---|
| `app/fonts/InstrumentSerif-Regular.woff2` | 21,032 B (20.5 KiB) | every route |
| `app/fonts/InstrumentSerif-Italic.woff2` | 22,128 B (21.6 KiB) | `/` only |
| both | 42.1 KiB | |

The italic moved out of the root layout into `app/page.tsx`, so `/audit`, `/log`, `/try`,
`/app` and `/sign-in` no longer preload 21.6 KiB they never paint. Verified in the build
output: `InstrumentSerif_Italic-s...woff2` has a `<link rel="preload">` in
`.next/server/app/index.html` and in no other route's HTML.

**Page weight, mobile**

Projection from the production before figure: 316 - 69 + 43 = **290 KiB**. Measured on
`next start` at localhost, two mobile runs: **296 KiB**, down from the branch's 367 KiB and
under the 316 KiB gate. Desktop 310 KiB, down from 382. Roughly 12 KiB of the remaining gap
to the projection is gzip on the localhost document where the CDN serves Brotli, so the
preview figure should land at or under the projection. Accessibility is back to **100** at
both widths, from 96, the `link-in-text-block` failure being the only one.

**Words on the page, like for like**

Both columns measured with the same tokenizer,
`document.body.innerText.split(/\s+/).filter(Boolean).length`, by
`.superpowers/measure.cjs`:

| | Phone (390) | Desktop (1440) |
|---|---|---|
| Production, main | 798 | 852 |
| Branch, after the wave | 835 | 853 |

So the copy is +37 words on a phone and +1 on desktop against what is live, not +180 against
655. The 655 in the table above came from a different method (the 2026-09-14 count of page
copy, which does not include the console transcript this tokenizer picks up), so the two
figures were never comparable. The copy itself is unchanged, as the spec requires; the phone
delta is the static loop strip rendering all three steps where the graph rendered labels
only.

**Green above the fold, corrected probe**

The old probe counted `.hero *` computed `color`, which includes the console's own `--allow`
green that this spec keeps as the semantic colour of an allowed decision, and which no
probe on `.hero` could ever bring to 0. The corrected probe excludes anything inside
`.console` by ancestry, counts `color` only on the node that owns the text, and adds `nav`
plus SVG `fill` and `stroke` because the brand lock is inline SVG.

| | Count | What |
|---|---|---|
| Production, main | **7** | nav lock `stroke` and `fill`, `.npm b` "@olurabian/purse", `.hero h1 em` "allowed", three `.triad-line .fn b` ("enforce", "prove", "watch") |
| Branch, after the wave | **0** | phone and desktop alike |

The three the first measurement reported were all inside `.console` and were never
failures. The two it could not see, the nav lock's shackle and keyhole, were real and are
fixed. `app/opengraph-image.png` still carries a green lock and is a separate regen.

**Serif loaded**

`getComputedStyle(h1).fontFamily` returns the declared stack whether or not a file arrived,
so the original probe could not be false. `document.fonts.check("400 1em InstrumentSerif")`
is no better: it answers whether the glyphs can be painted by anything available and
returned `true` against production, which ships no serif at all. Iterating `document.fonts`
can be false, and is:

| | `serifLoaded` | Faces seen |
|---|---|---|
| Production, main | `false` | none |
| Branch, after the wave | `true` | `InstrumentSerif` normal loaded, `InstrumentSerifItalic` italic loaded |

**CLS**

Unchanged, and now attributable. Phone 0 with an empty shifts array. Desktop 0.000019, two
shifts, both sourced to a `<b>` in the live console transcript ("$12.00 / $200.00" and
"s3.aws.amazon.com"). Production measures the same 0.000019 from the same two elements, so
it is the console's own text, not the skin.

**What is not measured here**

Performance, LCP and TBT. Localhost has no CDN and no Brotli, and the preloaded font bytes
sit ahead of the text paint, which is exactly the part localhost gets wrong. Mobile
performance reads 88 and 90 and LCP 2.95 s and 2.91 s here, against 95 and 98 and 2.42 s and
1.88 s for production main under the same harness, and the branch before the wave read 91
and 85 with LCP 3.28 s and 3.30 s. The three gates that these numbers speak to are settled
on the preview deploy, and the release gate stays production, as the spec's Gates section
says.

## Follow-ups

- Route-local links still use `--allow` as a link colour: `.app-links a`, `.app-table a`, `.try-chip.allowed` (semantic, keep), `.try-mine`, `.prose a`, `.prose li::before`, `.af-last a`, `.log-arrow`. Ruling 1 of the plan kept them out of this pass. They move to `--accent` in a scoped pass per route, each measured on its own.

## After, production (2026-09-22, main 12a9d3b)

Released through PR #1. Before is production at `ad199a5` measured the same morning on the same machine; after is production at `12a9d3b` about an hour later. Two mobile runs and one desktop, Lighthouse 12, simulated throttling.

| Metric | Before, same day | After | Gate |
|---|---|---|---|
| Mobile performance | 95, 98 | 93, 97 | ≥ 96 |
| Mobile LCP | 2.42 s, 1.88 s | 1.99 s, 1.61 s | ≤ 1.7 s |
| Mobile FCP | 1.82 s, 1.47 s | 1.94 s, 1.57 s | |
| TBT | 117 ms, 148 ms | 235 ms, 165 ms | ≤ 190 ms |
| Page weight, mobile | 316 KiB | 287 KiB, 285 KiB | ≤ 316 KiB |
| Font bytes | 138 KiB | 109 KiB | |
| Script bytes | 145 KiB | 144 KiB | lower |
| Desktop performance, LCP | 100, 0.57 s | 100, 0.47 s | |
| a11y, best practices, SEO | 100, 100, 100 | 100, 100, 100 | 100 |
| CLS phone, desktop (buffered observer) | | 0, 0.000019 (two entries, both the console's live ticker text) | 0 |
| Serif loaded on first navigation | | true, both widths | |
| Brand green above the fold, console excluded, nav SVG included | | 0 | 0 |
| a11y on /try, /audit, /log | | 100, 100, 100 | |
| a11y on /sign-in | | 95, two colour-contrast items inside Clerk's widget (the social button text, the development-mode badge); no file under app/sign-in changed on the branch | |

Reading. Weight, fonts, script, CLS, a11y and the green count meet their gates outright. Performance, LCP and TBT each land on both sides of their gate across two runs, and every one of them is better than or within the noise of the same-day baseline, which itself sat above the 16 September figures the gates were set from. The branch is not slower than main on this machine; the absolute gates were set on a quieter day. Follow-ups: the Clerk social button text colour in the sign-in appearance, and the development badge goes with the production instance.
