import { describe, it, expect } from "vitest";
import { ipFrom, reply, notConfigured } from "@/lib/try/env";

describe("ipFrom", () => {
  it("prefers x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(ipFrom(h)).toBe("203.0.113.9");
  });
  it("falls back to the first x-forwarded-for hop, trimmed", () => {
    const h = new Headers({ "x-forwarded-for": " 198.51.100.7 , 10.0.0.2" });
    expect(ipFrom(h)).toBe("198.51.100.7");
  });
  it("answers unknown when neither header is present", () => {
    expect(ipFrom(new Headers())).toBe("unknown");
  });
});

describe("reply", () => {
  it("a cacheSec reply carries the CDN cache-control header and the given status", () => {
    const r = reply({ status: 200, body: { ok: true }, cacheSec: 5 });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, s-maxage=5, stale-while-revalidate=5");
  });
  it("a plain reply carries no-store", () => {
    const r = reply({ status: 400, body: { error: "bad" } });
    expect(r.status).toBe(400);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("notConfigured", () => {
  it("answers 503 with the not-configured body and no-store", async () => {
    const r = notConfigured();
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: "playground not configured" });
  });
  it("two calls produce two distinct Response objects", () => {
    expect(notConfigured()).not.toBe(notConfigured());
  });
});
