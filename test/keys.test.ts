import { describe, it, expect } from "vitest";
import { newProjectKey, hashKey, keyPrefix, KEY_PREFIX } from "@/lib/watch/keys";

describe("project keys", () => {
  it("makes a dl_live_ key with 43 base64url characters of entropy and never the same one twice", () => {
    const a = newProjectKey();
    const b = newProjectKey();
    expect(a.startsWith(KEY_PREFIX)).toBe(true);
    expect(a.slice(KEY_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
  it("hashes to sha256 hex and prefixes with the first eight characters after dl_live_", () => {
    const key = "dl_live_aaaabbbbccccdddd";
    expect(hashKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(key)).toBe(hashKey("dl_live_aaaabbbbccccdddd"));
    expect(keyPrefix(key)).toBe("aaaabbbb");
    expect(keyPrefix("short")).toBe("short");
  });
});
