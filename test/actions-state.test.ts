import { describe, it, expect } from "vitest";
import { configLines } from "@/lib/watch/config-lines";

describe("the one-time key reveal threads the project's real stream", () => {
  it("configLines carries the given stream through, not a hardcoded default", () => {
    expect(configLines("dl_live_aaaabbbbccccdddd", "orders", "https://x.test")).toContain("MONITOR_STREAM=orders");
  });
});
