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
