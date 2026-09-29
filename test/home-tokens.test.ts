import { describe, it, expect } from "vitest";
import fs from "node:fs";

const read = (rel: string) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const layout = read("app/layout.tsx");
const page = read("app/page.tsx");
const auditPage = read("app/audit/page.tsx");

/**
 * Every `selector { body }` pair in globals.css. The file has no nested selectors;
 * @media wrappers are skipped by the regex because their body contains braces.
 *
 * Two limits to know before putting a selector in one of the lists below. A multi-line
 * selector list is attributed to its LAST line only, so `#stack,
#audit,
#start { }`
 * is recorded under `#start` and a lookup for `#stack` finds nothing. A single-line comma
 * list is recorded verbatim, so `bodyOf(".a")` also misses `.a, .b { ... }`. Either way
 * the miss is silent, which is what the empty-body guard at the end of this file catches.
 */
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

const fontSize = (f: string) => fs.statSync(new URL(`../app/fonts/${f}`, import.meta.url)).size;

describe("serif font", () => {
  it("is declared in the root layout as the regular face only", () => {
    const block = layout.slice(layout.indexOf("const InstrumentSerif"), layout.indexOf("export const metadata"));
    expect(block).toContain('variable: "--font-serif"');
    expect(block).toContain('display: "optional"');
    expect(block).toContain("preload: true");
    // Without this a cache miss under display: optional renders Arial at 77 percent, not a serif.
    expect(block).toContain('adjustFontFallback: "Times New Roman"');
    expect(block).toContain('path: "./fonts/InstrumentSerif-Regular.woff2"');
    // The italic belongs to the pages that paint it. A root declaration preloads 22 KiB on every route.
    expect(block).not.toContain("InstrumentSerif-Italic.woff2");
    expect(layout).not.toContain("--font-serif-italic");
  });
  it("declares the italic face on the homepage", () => {
    const block = page.slice(page.indexOf("const InstrumentSerifItalic"), page.indexOf("export const revalidate"));
    expect(block, "no InstrumentSerifItalic declaration in app/page.tsx").not.toBe("");
    expect(block).toContain('path: "./fonts/InstrumentSerif-Italic.woff2"');
    expect(block).toContain('weight: "400"');
    expect(block).toContain('style: "italic"');
    expect(block).toContain('variable: "--font-serif-italic"');
    expect(block).toContain('display: "optional"');
    expect(block).toContain("preload: true");
    expect(block).toContain('adjustFontFallback: "Times New Roman"');
    expect(page).toContain("<div className={InstrumentSerifItalic.variable}>");
  });
  /** Without its own declaration the /audit hero asks for an italic the page never loaded, and the browser slants the regular cut. */
  it("declares the same italic face on /audit and sets the hero emphasis in it", () => {
    const block = auditPage.slice(auditPage.indexOf("const InstrumentSerifItalic"), auditPage.indexOf("export const metadata"));
    expect(block, "no InstrumentSerifItalic declaration in app/audit/page.tsx").not.toBe("");
    expect(block).toContain('path: "../fonts/InstrumentSerif-Italic.woff2"');
    expect(block).toContain('style: "italic"');
    expect(block).toContain('variable: "--font-serif-italic"');
    expect(block).toContain('display: "optional"');
    expect(block).toContain("preload: true");
    expect(block).toContain('adjustFontFallback: "Times New Roman"');
    expect(auditPage).toMatch(/<main className=\{`[^`]*\$\{InstrumentSerifItalic\.variable\}`\}>/);
    const em = bodyOf(".af-hero h1 em");
    expect(em, ".af-hero h1 em not found").not.toBe("");
    expect(em).toMatch(/font-family:\s*var\(--font-serif-italic\),\s*var\(--serif\)/);
    expect(em).toMatch(/font-style:\s*italic/);
    expect(em).toMatch(/color:\s*var\(--accent\)/);
  });
  it("is applied on the html element next to the two Geist variables", () => {
    expect(layout).toMatch(/<html[^>]*className=\{`\$\{GeistSans\.variable\} \$\{GeistMono\.variable\} \$\{InstrumentSerif\.variable\}`\}/);
  });
  it("ships both files and the licence", () => {
    for (const f of ["InstrumentSerif-Regular.woff2", "InstrumentSerif-Italic.woff2", "InstrumentSerif-OFL.txt"]) {
      expect(fs.existsSync(new URL(`../app/fonts/${f}`, import.meta.url)), f).toBe(true);
    }
    const reg = fontSize("InstrumentSerif-Regular.woff2");
    expect(reg).toBeGreaterThan(8_000);
    expect(reg).toBeLessThan(60_000);
  });
});

describe("Geist stays subset", () => {
  /**
   * The two Geist faces are preloaded on every route, so their bytes sit ahead of the
   * text paint. scripts/subset-geist.py cuts them to the Latin range the site renders,
   * which is what pays for the preloaded serif inside the 316 KiB mobile gate. A fresh
   * upstream drop-in is ~70 KiB each and would silently break that gate, so the size is
   * a test and the script that reproduces it is committed.
   */
  it("keeps both variable faces under 40 KiB", () => {
    for (const f of ["Geist-Variable.woff2", "GeistMono-Variable.woff2"]) {
      expect(fontSize(f), f).toBeLessThan(40 * 1024);
      expect(fontSize(f), f).toBeGreaterThan(20 * 1024);
    }
  });
  it("ships the subsetting script and the Geist licence beside the modified files", () => {
    expect(fs.existsSync(new URL("../scripts/subset-geist.py", import.meta.url))).toBe(true);
    expect(fs.existsSync(new URL("../app/fonts/Geist-OFL.txt", import.meta.url))).toBe(true);
  });
});

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
  /**
   * The lock in the nav and the favicon are the brand mark and both hard-coded the old
   * green in markup, where the CSS audit above could never see it. app/opengraph-image.png
   * is a raster and is a separate regen.
   */
  it("the brand mark carries no green, in the nav or in the favicon", () => {
    for (const f of ["components/SiteNav.tsx", "app/icon.svg"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/37d07e|55,\s*208,\s*126/i);
      expect(src, f).toMatch(/7c93ff/i);
    }
  });
});

describe("accent links in running text", () => {
  /**
   * An accent link inside muted body text is 1.09:1 against the text around it, which is
   * colour alone as the only cue and a Lighthouse link-in-text-block failure. Nav links,
   * buttons and standalone CTAs are not running text and stay undecorated.
   */
  it("the proof band's inline link is underlined", () => {
    const body = bodyOf(".proof-line a");
    expect(body, ".proof-line a not found").not.toBe("");
    expect(body).toMatch(/text-decoration:\s*underline/);
    expect(body).not.toMatch(/text-decoration:\s*none/);
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

/** The display selectors that must resolve to the serif stack. */
const DISPLAY = [".hero h1", ".sec-head h2", ".why .big", ".brand", ".proof-n"];
/** The two emphasis selectors that must resolve to the homepage-only italic face first. */
const DISPLAY_ITALIC = [".hero h1 em", ".why .big em"];

describe("display type", () => {
  it("uses the serif on the hero headline, section heads, the big line, the brand and the proof numbers", () => {
    for (const sel of DISPLAY) {
      expect(bodyOf(sel), sel).toMatch(/font-family:\s*var\(--serif\)/);
      expect(bodyOf(sel), sel).toMatch(/font-weight:\s*400/);
    }
  });
  it("puts the homepage italic variable first on the two emphasis selectors", () => {
    for (const sel of DISPLAY_ITALIC) {
      expect(bodyOf(sel), sel).toMatch(/font-family:\s*var\(--font-serif-italic\),\s*var\(--serif\)/);
      expect(bodyOf(sel), sel).toMatch(/font-style:\s*italic/);
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

/**
 * A rename must fail loudly, not vacuously. Every selector asserted on above has to
 * resolve to a non-empty rule body: if a rule is renamed, `bodyOf()` returns "" and a
 * negative assertion such as `not.toMatch(GREEN)` passes against nothing at all. The
 * BRAND cases already carry this check one selector at a time; the display lists,
 * `.eyebrow` and `.proof-line a` did not.
 */
describe("every tested selector still exists", () => {
  it("resolves each asserted selector to a non-empty rule body", () => {
    const asserted = [...new Set([...BRAND, ...DISPLAY, ...DISPLAY_ITALIC, ":root", "body", ".eyebrow", ".proof-line a"])];
    const missing = asserted.filter((sel) => bodyOf(sel) === "");
    expect(missing, `selectors missing from app/globals.css: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("inner pages wear the skin", () => {
  for (const sel of [".log-hd h1", ".log-article-head h1", ".prose h2"]) {
    it(`${sel} is the serif at weight 400`, () => {
      expect(bodyOf(sel), sel).toMatch(/font-family:\s*var\(--serif\)/);
      expect(bodyOf(sel), sel).toMatch(/font-weight:\s*400/);
    });
  }
  for (const sel of [".log-arrow", ".prose a", ".prose a:hover", ".prose li::before", ".try .try-strip"]) {
    it(`${sel} carries no brand green or amber`, () => {
      const body = bodyOf(sel);
      expect(body, `${sel} not found`).not.toBe("");
      expect(body).not.toMatch(GREEN);
      expect(body).not.toMatch(/var\(--hold\)/);
    });
  }
  it("links in prose are underlined", () => {
    expect(bodyOf(".prose a")).toMatch(/text-decoration:\s*underline/);
  });
  it("wide pages have their own width", () => {
    expect(bodyOf(".logwrap.wide")).toMatch(/max-width:\s*1120px/);
  });
});

/** The stylesheet claimed 70px of section padding for weeks and never delivered it: `.wrap { padding: 0 24px }` outranked `section { … }`. The rule that applies must outrank .wrap. */
describe("section rhythm", () => {
  it("gives every wrapped section vertical padding through a selector that beats .wrap", () => {
    const body = bodyOf("section.wrap");
    expect(body, "section.wrap rule missing").not.toBe("");
    expect(body).toMatch(/padding:\s*72px 24px/);
    expect(body).toMatch(/padding:\s*48px 20px/);
    expect(bodyOf("section")).not.toMatch(/padding/);
  });
  it("keeps the proof band tight under the hero", () => {
    const body = bodyOf("section.proof");
    expect(body).toMatch(/padding-top:\s*0/);
    expect(body).toMatch(/padding-bottom:\s*28px/);
    expect(bodyOf(".proof")).toBe("");
  });
});
