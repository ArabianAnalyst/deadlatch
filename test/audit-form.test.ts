import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import AuditForm from "@/components/AuditForm";

describe("AuditForm", () => {
  const html = renderToStaticMarkup(createElement(AuditForm));
  it("opens with the example agent's verdict already on screen", () => {
    expect(html).toContain("Advisory with caps, forgery open and misdirection open");
    expect(html).toMatch(/Example agent loaded/);
  });
  it("shows all eight dimensions", () => {
    expect(html.match(/class="dim /g)).toHaveLength(8);
  });
  it("offers the example and a blank start, and keeps both report outputs", () => {
    for (const s of ["Load an example agent", "Start blank", "Copy report as markdown", "Save as HTML"]) expect(html).toContain(s);
  });
  it("shows the example's fractional money with two decimals", () => {
    expect(html).toContain('value="$12.50"');
    expect(html).not.toContain('value="$12.5"');
  });
  it("announces only the verdict sentence and the answered count", () => {
    expect(html).not.toMatch(/<aside[^>]*aria-live/);
    expect(html.match(/aria-live="polite"/g)).toHaveLength(2);
  });
  it("never sends what the visitor types anywhere", () => {
    const src = fs.readFileSync(new URL("../components/AuditForm.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|\bimport\s*\(|new\s+Image\s*\(|\bWebSocket\b|\bEventSource\b/);
  });
});
