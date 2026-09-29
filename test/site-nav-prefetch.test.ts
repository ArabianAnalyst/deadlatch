import { describe, it, expect } from "vitest";
import fs from "node:fs";

const nav = fs.readFileSync(new URL("../components/SiteNav.tsx", import.meta.url), "utf8");

describe("SiteNav prefetch", () => {
  /**
   * Prefetching `/` from every inner page pulls the homepage payload and the italic serif
   * the homepage declares, about 36 KiB, which put /try and /log over their 300 KiB gate.
   */
  it("never prefetches the homepage from the brand link", () => {
    const brand = nav.match(/<Link[^>]*className="brand"[^>]*>/);
    expect(brand, "brand link").not.toBeNull();
    expect(brand![0]).toMatch(/prefetch=\{false\}/);
  });
});
