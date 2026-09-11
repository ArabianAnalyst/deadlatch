import { describe, it, expect } from "vitest";
import { PRESETS, isPreset, isId, curlFor } from "@/lib/try/presets";

describe("presets", () => {
  it("has exactly the four bodies the spec fixes", () => {
    expect(PRESETS).toEqual({
      allowed: { amount: "$12.50", payee: "api.stripe.com", intent: "playground" },
      held: { amount: "$35.00", payee: "api.stripe.com", intent: "playground" },
      "over-cap": { amount: "$75.00", payee: "api.stripe.com", intent: "playground" },
      "off-list": { amount: "$12.50", payee: "evil.example", intent: "playground" },
    });
  });
  it("guards preset names and ids", () => {
    expect(isPreset("allowed")).toBe(true);
    expect(isPreset("ALLOWED")).toBe(false);
    expect(isPreset("")).toBe(false);
    expect(isPreset(3)).toBe(false);
    expect(isId("grant_abc123XYZ-_")).toBe(true);
    expect(isId("a".repeat(64))).toBe(true);
    expect(isId("a".repeat(65))).toBe(false);
    expect(isId("short")).toBe(false);
    expect(isId("has space here")).toBe(false);
    expect(isId({})).toBe(false);
  });
  it("builds a curl a visitor can paste", () => {
    const c = curlFor("https://purse-playground.fly.dev", "/request", PRESETS.allowed);
    expect(c).toBe(`curl -s https://purse-playground.fly.dev/request -H 'content-type: application/json' -d '{"amount":"$12.50","payee":"api.stripe.com","intent":"playground"}'`);
    expect(curlFor("https://x.test/", "/execute", { grantId: "g_12345678" })).toBe(`curl -s https://x.test/execute -H 'content-type: application/json' -d '{"grantId":"g_12345678"}'`);
  });
});
