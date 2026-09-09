import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "dl_live_";

/** dl_live_ plus 32 random bytes as base64url. Shown once, stored only as its hash. */
export function newProjectKey(): string {
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** The first eight characters after dl_live_, what lists and the monitor's own index show. */
export function keyPrefix(key: string): string {
  return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8) : key.slice(0, 8);
}
