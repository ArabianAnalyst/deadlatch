import { describe, it, expect } from "vitest";
import { brokerPost, witnessGet, UpstreamError } from "@/lib/try/upstream";

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response> | never): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
}

describe("brokerPost", () => {
  it("posts JSON and returns the status and body", async () => {
    const seen: { url?: string; body?: string; ct?: string } = {};
    const f = fakeFetch((url, init) => {
      seen.url = url; seen.body = String(init?.body); seen.ct = new Headers(init?.headers).get("content-type") ?? undefined;
      return new Response(JSON.stringify({ decision: "allowed", grantId: "g_12345678" }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const r = await brokerPost(f, "https://b.test/", "/request", { amount: "$1.00", payee: "x" });
    expect(seen.url).toBe("https://b.test/request");
    expect(seen.ct).toBe("application/json");
    expect(JSON.parse(seen.body!)).toEqual({ amount: "$1.00", payee: "x" });
    expect(r).toEqual({ status: 200, json: { decision: "allowed", grantId: "g_12345678" } });
  });
  it("passes an upstream 4xx through as status and body", async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ error: "bad grant" }), { status: 400 }));
    expect(await brokerPost(f, "https://b.test", "/execute", { grantId: "x" })).toEqual({ status: 400, json: { error: "bad grant" } });
  });
  it("turns a network failure into UpstreamError 502 broker", async () => {
    const f = fakeFetch(() => { throw new TypeError("fetch failed"); });
    await expect(brokerPost(f, "https://b.test", "/request", {})).rejects.toMatchObject({ status: 502, which: "broker", body: { error: "playground broker unreachable" } });
  });
  it("turns a non-JSON body into UpstreamError 502", async () => {
    const f = fakeFetch(() => new Response("<html>", { status: 200 }));
    await expect(brokerPost(f, "https://b.test", "/request", {})).rejects.toBeInstanceOf(UpstreamError);
  });
  it("aborts after timeoutMs and reports the broker as unreachable", async () => {
    const f = fakeFetch((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    await expect(brokerPost(f, "https://b.test", "/request", {}, 50)).rejects.toMatchObject({ status: 502, which: "broker", body: { error: "playground broker unreachable" } });
  });
});

describe("witnessGet", () => {
  it("gets and returns JSON", async () => {
    const f = fakeFetch((url) => new Response(JSON.stringify({ url }), { status: 200 }));
    expect(await witnessGet(f, "https://w.test:8082", "/chain?since=0&limit=2")).toEqual({ status: 200, json: { url: "https://w.test:8082/chain?since=0&limit=2" } });
  });
  it("names the witness when it is down", async () => {
    const f = fakeFetch(() => { throw new TypeError("fetch failed"); });
    await expect(witnessGet(f, "https://w.test:8082", "/verify")).rejects.toMatchObject({ status: 502, which: "witness", body: { error: "witness unreachable" } });
  });
});
