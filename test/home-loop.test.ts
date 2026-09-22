import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import fs from "node:fs";
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

  /**
   * renderToStaticMarkup renders a client component to the same static HTML, so the
   * assertions above cannot tell one from the other. The point of this component is that
   * it ships no JavaScript, and only the source can say so.
   */
  it("is a server component, with no use client directive", () => {
    const src = fs.readFileSync(new URL("../components/ControlLoop.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });
});
