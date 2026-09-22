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
