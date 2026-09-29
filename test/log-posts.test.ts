import { describe, it, expect } from "vitest";
import fs from "node:fs";
import matter from "gray-matter";

for (const slug of ["green-for-21-days", "four-states-of-a-control"]) {
  describe(slug, () => {
    const raw = fs.readFileSync(new URL(`../content/log/${slug}.md`, import.meta.url), "utf8");
    const { data, content } = matter(raw);
    it("has title, date and description", () => {
      expect(typeof data.title).toBe("string");
      expect(data.date).toBe("2026-09-29");
      expect(typeof data.description).toBe("string");
    });
    it("uses no colons or em dashes in its prose", () => {
      const prose = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/https?:\/\/\S+/g, "");
      expect(prose).not.toMatch(/—/);
      expect(prose).not.toMatch(/[A-Za-z0-9)"'”’\]*]: /);
    });
  });
}
