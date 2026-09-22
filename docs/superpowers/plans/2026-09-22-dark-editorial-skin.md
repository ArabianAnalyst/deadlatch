# Dark editorial skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin deadlatch.dev to the dark editorial direction (comp C): keep the dark ground and the live console, drop the brand green, the glow gradients and the node graph, add Instrument Serif as the display face, without losing any of the September performance gates.

**Architecture:** Four self-contained changes to one Next 16 site. (1) A third `next/font/local` face and three new CSS tokens. (2) Type rules and a brand-green-to-accent swap in `app/globals.css`, with glow gradients removed. (3) A static server-rendered `ControlLoop` component replacing the `@xyflow/react` graph, and the dependency removed. (4) Measurement against the gates. Every change is guarded by a static test that reads the CSS or renders the component, so a regression fails `npm test` rather than waiting for a human to notice.

**Tech Stack:** Next 16.3 (App Router), React 19, TypeScript, plain CSS in `app/globals.css` (1,613 lines, no Tailwind), `next/font/local`, Vitest 3 (node environment, `test/**/*.test.ts`), Playwright from the carousel install for measurement, Lighthouse via `npx`.

**Spec:** `docs/superpowers/specs/2026-09-22-dark-editorial-skin-design.md` (branch `home-skin`, commit `b7355ab`). The spec binds; where this plan and the spec disagree, the spec wins, except for the two rulings recorded under Global Constraints.

## Global Constraints

- Branch `home-skin` from main `ad199a5`. Never push, never touch main. Release is a separate step on ARABA's explicit Go.
- No new runtime dependency. Net dependencies go down by one (`@xyflow/react` removed).
- `--allow` `#37d07e` stays as the semantic colour for an allowed decision and for the enforce leg. Green, amber and red are the enforce, prove and watch leg colours across the site (`.card.enforce .tag`, `.signal.enforce`, `.inst.enforce`, and their prove and watch siblings). Those rules are not touched.
- New tokens, exact values: `--accent: #7c93ff`, `--accent-ink: #0a0c10`, `--serif: var(--font-serif), "Instrument Serif", Georgia, serif`. `--ground` stays `#0a0c10`.
- Every font uses `display: "optional"` and `preload: true`. CLS must stay 0.
- Copy is unchanged. The 655-word count from 2026-09-14 is re-measured in Task 4, not asserted by a test.
- **Ruling 1 (scope of the accent swap).** The spec's non-goal keeps `/try`, `/app`, `/audit`, `/log` and `/sign-in` unchanged beyond inherited tokens and the nav. Green links on those routes (`.app-links a`, `.app-table a`, `.try-*`, `.prose a`, `.af-last a`, `.log-arrow`) therefore stay green in this pass and are listed as a follow-up in the spec's After section. The swap in this plan covers the homepage selectors and the shared nav only. Cost if wrong: one more small pass later. Cost of the alternative: silently widening scope into four routes with their own gates.
- **Ruling 2 (shape of the green audit).** The spec's grep ("only console, proof and chip rules may reference green") is too coarse once the leg convention is known. The audit test instead names the brand selectors explicitly and asserts each is free of green, and asserts the file has zero `radial-gradient`. Cost if wrong: a brand-green use outside the named list survives; the list is derived from a full sweep of `var(--allow` in this plan, so the risk is a future addition, which the reviewer can extend the list for.
- Commands run from the repo root `C:/Users/ARABA/Workspace/SaaS/deadlatch`. Every shell block starts with a guard: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1`.
- Never stage `.agents/`, `.claude/`, `.playwright-cli/`, `skills-lock.json`, `.env.local`, `lh-*.json`.
- Commit messages: imperative, lower case type prefix as the repo uses (`feat:`, `style:`, `test:`, `docs:`), end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/fetch-instrument-serif.mjs` (create) | Reproducible download of the two latin woff2 subsets and the OFL text from Google Fonts | 1 |
| `app/fonts/InstrumentSerif-Regular.woff2`, `app/fonts/InstrumentSerif-Italic.woff2`, `app/fonts/InstrumentSerif-OFL.txt` (create) | The display face, committed like Geist is | 1 |
| `app/layout.tsx` (modify lines 7-33, 74) | Third `localFont` declaration, variable applied on `<html>` | 1 |
| `app/globals.css` `:root` (modify lines 1-22) | Three new tokens | 1 |
| `test/home-tokens.test.ts` (create in 1, extend in 2) | Static tests over `globals.css` and `layout.tsx`: tokens exist, font declared, brand selectors green-free, no radial gradients, accent contrast | 1, 2 |
| `app/globals.css` type and brand rules (modify) | Serif on display elements, accent replaces brand green, glows removed | 2 |
| `components/ControlLoop.tsx` (create) | Static three-step strip, server component, no props | 3 |
| `test/home-loop.test.ts` (create) | Renders `ControlLoop` with `react-dom/server`, asserts order and absence of `rf-` | 3 |
| `app/page.tsx` (modify lines 3, 143) | Import and render `ControlLoop` instead of `FlowGraphLazy` | 3 |
| `components/FlowGraph.tsx`, `components/FlowGraphLazy.tsx` (delete), `app/globals.css` lines 776-866 (delete), `package.json` + lockfile (modify) | Graph and its library gone | 3 |
| `docs/superpowers/specs/2026-09-22-dark-editorial-skin-design.md` (append "After, local") | Before and after table, follow-ups | 4 |

---

### Task 1: Instrument Serif and the new tokens

**Files:**
- Create: `scripts/fetch-instrument-serif.mjs`
- Create: `app/fonts/InstrumentSerif-Regular.woff2`, `app/fonts/InstrumentSerif-Italic.woff2`, `app/fonts/InstrumentSerif-OFL.txt`
- Modify: `app/layout.tsx:7-33` (add a declaration after `GeistMono`), `app/layout.tsx:74` (apply the variable)
- Modify: `app/globals.css:1-22` (`:root`)
- Test: `test/home-tokens.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: CSS custom properties `--accent`, `--accent-ink`, `--serif` on `:root`, and `--font-serif` on `<html>` (set by Next from `InstrumentSerif.variable`). Task 2 uses `var(--serif)` and `var(--accent)`. Task 3 uses both in the loop rules.

- [ ] **Step 1: Write the failing test**

Create `test/home-tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const read = (rel: string) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const layout = read("app/layout.tsx");

/** Every `selector { body }` pair in globals.css. The file has no nested selectors; @media wrappers are skipped by the regex because their body contains braces. */
export function rules(): Array<{ sel: string; body: string }> {
  const out: Array<{ sel: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push({ sel: (m[1].split("\n").pop() ?? "").trim(), body: m[2] });
  return out;
}
export const bodyOf = (sel: string) => rules().filter((r) => r.sel === sel).map((r) => r.body).join("\n");

describe("tokens", () => {
  const root = bodyOf(":root");
  it("defines the accent, its ink and the serif stack", () => {
    expect(root).toMatch(/--accent:\s*#7c93ff;/);
    expect(root).toMatch(/--accent-ink:\s*#0a0c10;/);
    expect(root).toMatch(/--serif:\s*var\(--font-serif\),\s*"Instrument Serif",\s*Georgia,\s*serif;/);
  });
  it("keeps the ground and the allow colour as they were", () => {
    expect(root).toMatch(/--ground:\s*#0a0c10;/);
    expect(root).toMatch(/--allow:\s*#37d07e;/);
  });
});

describe("serif font", () => {
  it("is declared as a local font with display optional and preload", () => {
    const block = layout.slice(layout.indexOf("const InstrumentSerif"), layout.indexOf("export const metadata"));
    expect(block).toContain('variable: "--font-serif"');
    expect(block).toContain('display: "optional"');
    expect(block).toContain("preload: true");
    expect(block).toContain('path: "./fonts/InstrumentSerif-Regular.woff2"');
    expect(block).toContain('path: "./fonts/InstrumentSerif-Italic.woff2"');
  });
  it("is applied on the html element next to the two Geist variables", () => {
    expect(layout).toMatch(/<html[^>]*className=\{`\$\{GeistSans\.variable\} \$\{GeistMono\.variable\} \$\{InstrumentSerif\.variable\}`\}/);
  });
  it("ships both files and the licence", () => {
    for (const f of ["InstrumentSerif-Regular.woff2", "InstrumentSerif-Italic.woff2", "InstrumentSerif-OFL.txt"]) {
      expect(fs.existsSync(new URL(`../app/fonts/${f}`, import.meta.url)), f).toBe(true);
    }
    const reg = fs.statSync(new URL("../app/fonts/InstrumentSerif-Regular.woff2", import.meta.url)).size;
    expect(reg).toBeGreaterThan(8_000);
    expect(reg).toBeLessThan(60_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npx vitest run test/home-tokens.test.ts`
Expected: FAIL. "defines the accent" fails on `--accent`, "is declared as a local font" fails because `indexOf("const InstrumentSerif")` is -1, "ships both files" fails on `existsSync`.

- [ ] **Step 3: Write the fetch script and run it**

Create `scripts/fetch-instrument-serif.mjs`:

```js
// Downloads the latin woff2 subsets of Instrument Serif that Google Fonts serves, plus the OFL text.
// Run once: node scripts/fetch-instrument-serif.mjs
import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CSS_URL = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
const OFL_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentserif/OFL.txt";
const OUT = path.resolve("app/fonts");

const css = await (await fetch(CSS_URL, { headers: { "user-agent": UA } })).text();
// Google's css2 output places a "/* latin */" comment before each latin @font-face block.
const pick = (style) => {
  const re = new RegExp(String.raw`/\* latin \*/\s*@font-face\s*\{[^}]*font-style:\s*${style}[^}]*url\((https:[^)]+\.woff2)\)`);
  const m = css.match(re);
  if (!m) throw new Error(`no latin ${style} face in the css response`);
  return m[1];
};
const save = async (url, name) => {
  const buf = Buffer.from(await (await fetch(url, { headers: { "user-agent": UA } })).arrayBuffer());
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, buf.length, "bytes");
};
fs.mkdirSync(OUT, { recursive: true });
await save(pick("normal"), "InstrumentSerif-Regular.woff2");
await save(pick("italic"), "InstrumentSerif-Italic.woff2");
fs.writeFileSync(path.join(OUT, "InstrumentSerif-OFL.txt"), await (await fetch(OFL_URL)).text());
console.log("InstrumentSerif-OFL.txt written");
```

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; node scripts/fetch-instrument-serif.mjs && ls -l app/fonts`
Expected: three new files listed. Each woff2 between roughly 10 and 40 KB. If the css fetch returns TTF urls instead of woff2, the user agent header was dropped; the regex only accepts `.woff2`, so the script throws rather than saving the wrong format.

- [ ] **Step 4: Declare the font in `app/layout.tsx`**

Insert after the `GeistMono` declaration (after line 33) and before `export const metadata`:

```ts
// The display face. Two static files rather than a variable font; the site uses one weight.
const InstrumentSerif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
  display: "optional",
  preload: true,
});
```

Change line 74 from

```tsx
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

to

```tsx
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${InstrumentSerif.variable}`}>
```

- [ ] **Step 5: Add the tokens to `:root` in `app/globals.css`**

After line 20 (`  --focus: #5b8def;`) insert:

```css
  --accent: #7c93ff; /* brand accent on dark. 7.6:1 on --ground, 6.9:1 on --panel */
  --accent-ink: #0a0c10;
```

After line 22 (the `--mono:` line) insert, still inside `:root`:

```css
  --serif: var(--font-serif), "Instrument Serif", Georgia, serif;
```

- [ ] **Step 6: Run the test to verify it passes, then the whole suite and the type check**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npx vitest run test/home-tokens.test.ts && npm run lint && npm test`
Expected: home-tokens 5 passed; `tsc --noEmit` clean; full suite 84 passed (79 + 5).

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
git add scripts/fetch-instrument-serif.mjs app/fonts/InstrumentSerif-Regular.woff2 app/fonts/InstrumentSerif-Italic.woff2 app/fonts/InstrumentSerif-OFL.txt app/layout.tsx app/globals.css test/home-tokens.test.ts
git commit -m "feat(home): Instrument Serif as the display face, accent and serif tokens

Two latin woff2 subsets and the OFL text, fetched by a committed script.
display optional and preload, the same shape as Geist, so a late face is
not used and cannot shift the hero.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Type rules, brand green to accent, glow removal

**Files:**
- Modify: `app/globals.css` at the lines named below (numbers are as of `b7355ab` plus the three lines Task 1 added to `:root`; the implementer finds each rule by its selector, never by line number alone)
- Test: `test/home-tokens.test.ts` (extend)

**Interfaces:**
- Consumes: `--accent`, `--serif` from Task 1.
- Produces: nothing programmatic. Task 3's loop rules follow the same conventions (serif for `.loop-t`, accent for `.loop-k`).

- [ ] **Step 1: Write the failing tests**

Append to `test/home-tokens.test.ts`:

```ts
const GREEN = /var\(--allow(?:-bg|-ln)?\)|#37d07e|#43e08c|#062012|55,\s*208,\s*126/;

/** Homepage and shared-nav selectors where green meant "brand". Leg colours (.card.enforce, .signal.enforce, .inst.enforce) and decision chips are semantic and are not in this list. Route-local links on /app, /try, /audit and /log are a follow-up, see the spec's After section. */
const BRAND = [".npm b", ".hero h1 em", ".flag", ".btn.primary", ".btn.primary:hover", ".triad-line .fn b", ".why .big em", ".proof-line a", ".foot-close em"];

describe("brand green is gone from the homepage", () => {
  for (const sel of BRAND) {
    it(`${sel} carries no green`, () => {
      const body = bodyOf(sel);
      expect(body, `${sel} not found`).not.toBe("");
      expect(body).not.toMatch(GREEN);
    });
  }
  it("the headline emphasis is the accent, in italic", () => {
    const body = bodyOf(".hero h1 em");
    expect(body).toMatch(/color:\s*var\(--accent\)/);
    expect(body).toMatch(/font-style:\s*italic/);
  });
  it("the primary button is ink on ground", () => {
    const body = bodyOf(".btn.primary");
    expect(body).toMatch(/background:\s*var\(--ink\)/);
    expect(body).toMatch(/color:\s*var\(--ground\)/);
  });
  it("the eyebrow is the accent", () => {
    expect(bodyOf(".eyebrow")).toMatch(/color:\s*var\(--accent\)/);
  });
});

describe("no glow", () => {
  it("has no radial gradient anywhere", () => {
    expect(css.match(/radial-gradient/g) ?? []).toHaveLength(0);
  });
  it("body has no fixed background image and no vignette pseudo element", () => {
    expect(bodyOf("body")).not.toMatch(/background-image|background-attachment/);
    expect(bodyOf("body::before")).toBe("");
  });
});

describe("display type", () => {
  it("uses the serif on the hero headline, section heads, the big line, the brand and the proof numbers", () => {
    for (const sel of [".hero h1", ".sec-head h2", ".why .big", ".brand", ".proof-n"]) {
      expect(bodyOf(sel), sel).toMatch(/font-family:\s*var\(--serif\)/);
      expect(bodyOf(sel), sel).toMatch(/font-weight:\s*400/);
    }
  });
});

/** WCAG 2.1 relative luminance and contrast ratio, so the accent cannot drift below AA unnoticed. */
function lum(hex: string): number {
  const c = hex.replace("#", "").match(/../g)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("contrast", () => {
  it("accent passes AA on the ground and on a panel", () => {
    expect(contrast("#7c93ff", "#0a0c10")).toBeGreaterThan(4.5);
    expect(contrast("#7c93ff", "#11151b")).toBeGreaterThan(4.5);
  });
  it("primary button text passes AA", () => {
    expect(contrast("#0a0c10", "#e8edf3")).toBeGreaterThan(7);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npx vitest run test/home-tokens.test.ts`
Expected: FAIL. The nine `carries no green` cases fail, "no radial gradient" fails with 9 matches, "display type" fails on every selector. The contrast cases pass already (they test constants) and that is fine.

- [ ] **Step 3: Type rules in `app/globals.css`**

Replace the `.hero h1` rule (currently at 175-182):

```css
.hero h1 {
  font-family: var(--serif);
  font-size: clamp(2.6rem, 5.2vw, 4.1rem);
  line-height: 1;
  letter-spacing: -0.012em;
  font-weight: 400;
  text-wrap: balance;
  margin: 16px 0 0;
}
.hero h1 em {
  font-style: italic;
  color: var(--accent);
}
```

Replace `.sec-head h2` (currently at 628-635):

```css
.sec-head h2 {
  font-family: var(--serif);
  font-size: clamp(1.8rem, 3.4vw, 2.5rem);
  letter-spacing: -0.01em;
  line-height: 1.08;
  text-wrap: balance;
  font-weight: 400;
  margin-top: 14px;
}
```

Replace `.why .big` and `.why .big em` (currently at 733-744):

```css
.why .big {
  font-family: var(--serif);
  font-size: clamp(2rem, 3.8vw, 2.9rem);
  line-height: 1.08;
  letter-spacing: -0.01em;
  font-weight: 400;
  text-wrap: balance;
}
.why .big em {
  font-style: italic;
  color: var(--accent);
}
```

In `.brand` (currently at 97-103) change `font-family: var(--mono);` to `font-family: var(--serif);`, `font-weight: 600;` to `font-weight: 400;`, and add `font-size: 1.5rem;`. Keep the flex, gap and letter-spacing lines.

Replace the `.proof-n` one-liner (currently at 1589):

```css
.proof-n { font-family: var(--serif); font-size: 2.1rem; font-weight: 400; letter-spacing: -0.01em; color: var(--ink); overflow-wrap: anywhere; line-height: 1; }
```

In `.flag` (currently at 197-204) change `border-left: 2px solid var(--allow-ln);` to `border-left: 2px solid var(--accent);`, `font-family: var(--sans);` to `font-family: var(--serif);`, and `font-size: 1.02rem;` to `font-size: 1.35rem;`. Then add, after `.flag span`'s existing rule, nothing: the span already sets its own colour and size, but it inherits the serif, so add `font-family: var(--sans);` inside `.flag span`.

- [ ] **Step 4: Brand green to accent**

`.eyebrow` (currently 69-75): change `color: var(--faint);` to `color: var(--accent);`.

`.npm b` (currently 137): change `color: var(--allow);` to `color: var(--accent);`.

`.btn.primary` and `.btn.primary:hover` (currently 233-241) become:

```css
.btn.primary {
  background: var(--ink);
  color: var(--ground);
  border-color: var(--ink);
  font-weight: 600;
}
.btn.primary:hover {
  background: #ffffff;
  border-color: #ffffff;
}
```

`.triad-line .fn b` (currently 262-264): change `color: var(--allow);` to `color: var(--accent);`.

`.proof-line a` (currently 1592): change `color: var(--allow);` to `color: var(--accent);`.

`.foot-close em` (currently 1610): change `color: var(--allow);` to `color: var(--accent);`.

- [ ] **Step 5: Remove the glows**

In `body` (35-46): delete the three-line `background-image: radial-gradient(...), radial-gradient(...), linear-gradient(...);` declaration and the `background-attachment: fixed;` line. The rule keeps `background: var(--ground);` and everything else.

Delete the whole `body::before { ... }` rule (47-54).

Delete the whole `.hero::before { ... }` rule (160-170). Keep `.hero > * { position: relative; ... }` that follows it.

Delete the whole `.now::before { ... }` rule (871-880). Keep `.now { position: relative; }`.

Delete the whole `#start::before { ... }`, `#stack::before { ... }`, `#audit::before { ... }` and the second `#start::before { ... }` rules (891-907). If any of those pseudo elements also carried a `content: ""` and `position: absolute` in a shared rule such as `.sec::before`, delete that shared rule too; a pseudo element with no background is dead weight.

- [ ] **Step 6: Run the tests to verify they pass, then the suite, the type check and a build**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npx vitest run test/home-tokens.test.ts && npm run lint && npm test && npm run build 2>&1 | tail -15`
Expected: home-tokens all passed (5 from Task 1 plus 17 new); full suite green, 101 tests; build succeeds with no warnings about fonts.

- [ ] **Step 7: Look at it once**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; (npm run start -- -p 3010 > /dev/null 2>&1 &) ; sleep 4; node -e '
const { chromium } = require("C:/Users/ARABA/Workspace/Social Content/Carousels/mwp-system/node_modules/playwright");
(async () => { const b = await chromium.launch(); for (const [n, w] of [["desk", 1440], ["phone", 390]]) { const p = await b.newPage({ viewport: { width: w, height: w > 400 ? 900 : 844 } }); await p.goto("http://localhost:3010/", { waitUntil: "networkidle" }); await p.screenshot({ path: `.superpowers/skin-${n}.png` }); await p.close(); } await b.close(); console.log("ok"); })();'`

Then read `.superpowers/skin-desk.png` and `.superpowers/skin-phone.png`. Expected: serif headline in three lines on desktop, italic accent on "allowed", ink-filled primary button, no green anywhere above the console, flat ground with no glow, console unchanged. Stop the server afterwards: `npx kill-port 3010` or `taskkill //F //IM node.exe` is too broad, so prefer `netstat -ano | findstr :3010` and `taskkill //PID <pid> //F`. Do not commit the screenshots (`.superpowers/` is git-ignored).

- [ ] **Step 8: Commit**

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
git add app/globals.css test/home-tokens.test.ts
git commit -m "style(home): serif display type, accent replaces brand green, glows removed

Green stays where it means allowed or enforce. The nine homepage and nav
selectors where it meant brand now use --accent, guarded by a test that
names each one. Zero radial gradients, guarded the same way.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The control loop replaces the graph

**Files:**
- Create: `components/ControlLoop.tsx`
- Create: `test/home-loop.test.ts`
- Modify: `app/page.tsx:3` (import), `app/page.tsx:143` (render)
- Modify: `app/globals.css` (delete 776-866 `.rf-*` rules, add `.loop*` rules in their place)
- Delete: `components/FlowGraph.tsx`, `components/FlowGraphLazy.tsx`
- Modify: `package.json`, `package-lock.json` (remove `@xyflow/react`)

**Interfaces:**
- Consumes: `--accent`, `--serif`, `--panel`, `--line`, `--line2`, `--muted`, `--ink` tokens.
- Produces: `ControlLoop`, a default-exported React server component with no props, rendering `div.loop > (div.loop-step | div.loop-arrow)*`.

- [ ] **Step 1: Write the failing test**

Create `test/home-loop.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ControlLoop from "@/components/ControlLoop";

describe("ControlLoop", () => {
  const html = renderToStaticMarkup(createElement(ControlLoop));

  it("renders three steps in the order enforce, prove, watch", () => {
    const steps = [...html.matchAll(/<div class="loop-step"[^>]*>([\s\S]*?)<\/div><\/div>/g)].map((m) => m[1]);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("1 · enforce");
    expect(steps[0]).toContain("Purse decides it");
    expect(steps[1]).toContain("2 · prove");
    expect(steps[1]).toContain("blackbox records it");
    expect(steps[2]).toContain("3 · watch");
    expect(steps[2]).toContain("Tripwire watches the outcome");
  });

  it("puts an arrow between steps and nowhere else", () => {
    expect(html.match(/class="loop-arrow"/g)).toHaveLength(2);
    expect(html.startsWith('<div class="loop"')).toBe(true);
  });

  it("is static markup with nothing left of the graph", () => {
    expect(html).not.toMatch(/rf-|react-flow|xyflow/);
    expect(html).not.toMatch(/<script/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npx vitest run test/home-loop.test.ts`
Expected: FAIL, "Cannot find module '@/components/ControlLoop'".

- [ ] **Step 3: Write the component**

Create `components/ControlLoop.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npx vitest run test/home-loop.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Wire it into the page and remove the graph**

In `app/page.tsx` line 3, change `import FlowGraphLazy from "@/components/FlowGraphLazy";` to `import ControlLoop from "@/components/ControlLoop";`. At line 143 change `<FlowGraphLazy />` to `<ControlLoop />`.

Delete the two files:

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
git rm -q components/FlowGraph.tsx components/FlowGraphLazy.tsx
```

In `app/globals.css`, delete every rule from `.rf-wrap {` (currently 776) through the end of `.rf-wrap .react-flow__edge-textbg { ... }` (currently 862-866), and in their place insert:

```css
.loop {
  display: grid;
  grid-template-columns: 1fr 28px 1fr 28px 1fr;
  gap: 12px;
  align-items: stretch;
  margin-top: 28px;
}
.loop-step {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 18px 16px;
}
.loop-k {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}
.loop-t {
  font-family: var(--serif);
  font-size: 1.5rem;
  line-height: 1.1;
  margin-top: 8px;
  color: var(--ink);
}
.loop-s {
  color: var(--muted);
  font-size: 0.94rem;
  margin-top: 6px;
}
.loop-arrow {
  position: relative;
}
.loop-arrow::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid var(--line2);
}
.loop-arrow::after {
  content: "";
  position: absolute;
  right: 0;
  top: 50%;
  width: 7px;
  height: 7px;
  border-top: 1px solid var(--line2);
  border-right: 1px solid var(--line2);
  transform: translateY(-50%) rotate(45deg);
}
@media (max-width: 760px) {
  .loop {
    grid-template-columns: 1fr;
  }
  .loop-arrow {
    height: 24px;
  }
  .loop-arrow::before {
    left: 50%;
    right: auto;
    top: 0;
    bottom: 0;
    border-top: 0;
    border-left: 1px solid var(--line2);
  }
  .loop-arrow::after {
    right: auto;
    left: 50%;
    top: auto;
    bottom: 0;
    transform: translateX(-50%) rotate(135deg);
  }
}
```

Then remove the dependency:

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
npm uninstall @xyflow/react
grep -rnE "xyflow|FlowGraph|rf-wrap|rf-node|react-flow" app components lib test package.json | grep -v node_modules
```

Expected: `npm uninstall` updates `package.json` and `package-lock.json`; the grep prints nothing.

- [ ] **Step 6: Run everything**

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; npm run lint && npm test && npm run build 2>&1 | tail -20`
Expected: type check clean, 104 tests passed (79 + 5 + 17 + 3; if the count differs, state the real number in the report), build succeeds. Note the First Load JS for `/` printed by the build; it should be lower than on main because 184 KiB of graph script is gone.

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
git add components/ControlLoop.tsx test/home-loop.test.ts app/page.tsx app/globals.css package.json package-lock.json
git commit -m "feat(home): a static control loop replaces the react-flow graph

Three server rendered panels, no script, no observer. @xyflow/react is
gone from the dependencies and the lockfile. A test renders the loop and
asserts the order and that nothing of the graph remains.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Measure against the gates and write the After table

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-dark-editorial-skin-design.md` (append a section)
- Create, not committed: `.superpowers/lh-*.json`, `.superpowers/measure.cjs`

**Interfaces:**
- Consumes: the built site from Task 3.
- Produces: the numbers ARABA reads before saying Go.

- [ ] **Step 1: Build and serve the branch**

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
npm run build > /dev/null && (npm run start -- -p 3010 > .superpowers/start.log 2>&1 &) && sleep 4 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/
```

Expected: `200`.

- [ ] **Step 2: Lighthouse, mobile twice and desktop once, on production and on the branch**

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
for t in "before https://www.deadlatch.dev/" "after http://localhost:3010/"; do set -- $t
  for i in 1 2; do npx -y lighthouse@12 "$2" --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json --output-path=".superpowers/lh-$1-mobile-$i.json" --chrome-flags="--headless=new" --quiet; done
  npx -y lighthouse@12 "$2" --only-categories=performance,accessibility,best-practices,seo --preset=desktop --output=json --output-path=".superpowers/lh-$1-desktop.json" --chrome-flags="--headless=new" --quiet
done
node -e '
const fs=require("fs");for(const f of fs.readdirSync(".superpowers").filter(f=>f.startsWith("lh-")).sort()){const j=JSON.parse(fs.readFileSync(".superpowers/"+f));const c=j.categories,a=j.audits;console.log(f.padEnd(28),"perf",Math.round(c.performance.score*100),"a11y",Math.round(c.accessibility.score*100),"bp",Math.round(c["best-practices"].score*100),"seo",Math.round(c.seo.score*100),"LCP",(a["largest-contentful-paint"].numericValue/1000).toFixed(2)+"s","CLS",a["cumulative-layout-shift"].numericValue.toFixed(3),"TBT",Math.round(a["total-blocking-time"].numericValue)+"ms","KiB",Math.round(a["total-byte-weight"].numericValue/1024));}'
```

Expected: six lines. Localhost LCP is indicative only (no CDN), so the comparison that matters is CLS, TBT, byte weight and the category scores; the production LCP is re-measured after release, as the spec says.

- [ ] **Step 3: Buffered layout-shift observer, word count and green check on the rendered page**

Create `.superpowers/measure.cjs`:

```js
const { chromium } = require("C:/Users/ARABA/Workspace/Social Content/Carousels/mwp-system/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h] of [["phone", 390, 844], ["desktop", 1440, 900]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, src: (e.sources || []).map((s) => s.node && s.node.tagName + (s.node.className ? "." + s.node.className : "")).join("|") }); }).observe({ type: "layout-shift", buffered: true });
    });
    await p.goto("http://localhost:3010/", { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({
      cls: window.__shifts.reduce((a, s) => a + s.v, 0),
      shifts: window.__shifts,
      words: document.body.innerText.split(/\s+/).filter(Boolean).length,
      greenAboveFold: [...document.querySelectorAll(".hero *")].filter((el) => getComputedStyle(el).color === "rgb(55, 208, 126)").length,
      serifOnH1: getComputedStyle(document.querySelector("h1")).fontFamily.includes("Instrument Serif"),
    }));
    console.log(name, JSON.stringify(r));
    await p.close();
  }
  await b.close();
})();
```

Run: `cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1; node .superpowers/measure.cjs`
Expected: `cls` 0 at both widths with an empty `shifts` array, `words` at or under 655, `greenAboveFold` 0, `serifOnH1` true. If `serifOnH1` is false, the font did not load inside the optional window on a cold start; reload once (Playwright caches nothing between contexts, so use `p.reload()` after the first goto) and record both results honestly.

Stop the server: `netstat -ano | findstr :3010` then `taskkill //PID <pid> //F`.

- [ ] **Step 4: Append the After section to the spec**

Append to `docs/superpowers/specs/2026-09-22-dark-editorial-skin-design.md`:

```markdown
## After, local (2026-09-22, branch home-skin)

Before is production at main `ad199a5`. After is `next start` on localhost, so LCP is indicative only and the production LCP is re-measured after release.

| Metric | Before (production) | After (localhost) | Gate |
|---|---|---|---|
| Mobile performance, two runs | | | ≥ 96 |
| Desktop performance | | | |
| Mobile LCP | | | ≤ 1.7 s (production) |
| CLS, phone and desktop, buffered observer | | | 0 |
| TBT | | | ≤ 190 ms |
| Page weight, mobile | | | ≤ 316 KiB |
| a11y, best practices, SEO | | | 100 |
| Words on the page | 655 | | ≤ 655 |
| Green above the fold | | 0 | 0 |
| First Load JS for `/` from `next build` | | | lower than main |

## Follow-ups

- Route-local links still use `--allow` as a link colour: `.app-links a`, `.app-table a`, `.try-chip.allowed` (semantic, keep), `.try-mine`, `.prose a`, `.prose li::before`, `.af-last a`, `.log-arrow`. Ruling 1 of the plan kept them out of this pass. They move to `--accent` in a scoped pass per route, each measured on its own.
```

Fill every empty cell with the numbers from Steps 2 and 3. A cell that fails its gate is written down as it is; the plan does not release, and the report says which gate failed.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/ARABA/Workspace/SaaS/deadlatch" && git rev-parse --show-toplevel | grep -qi deadlatch || exit 1
git add docs/superpowers/specs/2026-09-22-dark-editorial-skin-design.md
git commit -m "docs(spec): after table for the dark editorial skin, measured on the branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Tokens and serif (Task 1). Every selector in the spec's two tables (Task 2), with `.flag span` kept in Geist as the spec says. The `.brand` and `.proof-n` serif rules (Task 2). Glow removal including the amber `#audit::before` (Task 2). The loop markup, the phone stacking, the deletions and the dependency removal with the lockfile (Task 3). The green audit as a test rather than a grep, and the two added tests the spec names, `home-loop` and the tokens file (Tasks 2 and 3). Gates measured with the same method as the LCP pass, After table appended (Task 4). Release on Go is outside the plan by design. The spec's coarse grep is replaced under Ruling 2, and the spec's route non-goal is honoured under Ruling 1, both recorded above and in the After section.

**Placeholder scan.** No TBD, no "similar to", every code step carries the code. Task 2 Step 5 names line ranges as of the spec commit and instructs finding rules by selector, since Task 1 shifts lines by three.

**Type consistency.** `rules()` and `bodyOf()` are defined in Task 1's test file and reused by Task 2's additions in the same file. `ControlLoop` is default-exported in Task 3 and imported by default in `app/page.tsx` and the test. Class names `.loop`, `.loop-step`, `.loop-arrow`, `.loop-k`, `.loop-t`, `.loop-s` match between the component, the CSS and the test. Test counts: 79 existing, plus 5 in Task 1, plus 18 in Task 2 (9 brand cases, 3 named, 2 glow, 1 type, 2 contrast, plus the loop that produces one case per BRAND entry equals 9, so the exact number is 9 + 3 + 2 + 1 + 2 = 17; Task 2 Step 6 should read 17 and Task 3 Step 6 should read 79 + 5 + 17 + 3 = 104 if vitest counts each `it` once). Corrected: Task 2 adds 17 cases, Task 3 adds 3, full suite 104. The implementer reports the real number.
