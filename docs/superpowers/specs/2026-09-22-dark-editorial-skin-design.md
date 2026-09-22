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
| `--accent` | none | `#7c93ff` | brand accent on dark. 7.6:1 on `--ground`, passes AA at every size used |
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
| nav `App` link and any `.ghlink` | `color` | green | `var(--accent)` |
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

Unchanged. The h1, lede, flag, section heads and the loop's three lines carry the same meaning as today. Word count stays inside the 655 measured on 2026-09-14, and the existing copy count test must still pass.

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
