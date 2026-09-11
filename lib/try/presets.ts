/** The only bodies the playground ever sends to the broker. A visitor picks a name, the server picks the body. */
export const PRESETS = {
  allowed: { amount: "$12.50", payee: "api.stripe.com", intent: "playground" },
  held: { amount: "$35.00", payee: "api.stripe.com", intent: "playground" },
  "over-cap": { amount: "$75.00", payee: "api.stripe.com", intent: "playground" },
  "off-list": { amount: "$12.50", payee: "evil.example", intent: "playground" },
} as const;

export type Preset = keyof typeof PRESETS;
export type PresetBody = (typeof PRESETS)[Preset];

export function isPreset(x: unknown): x is Preset {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(PRESETS, x);
}

/** Grant and pending ids as the broker mints them, url-safe, eight to sixty-four characters. */
export const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export function isId(x: unknown): x is string {
  return typeof x === "string" && ID_RE.test(x);
}

/** The curl that does what the page just did, against the public broker, so nobody has to trust the page. */
export function curlFor(brokerUrl: string, path: "/request" | "/execute" | "/status", body: object): string {
  const base = brokerUrl.replace(/\/+$/, "");
  return `curl -s ${base}${path} -H 'content-type: application/json' -d '${JSON.stringify(body)}'`;
}
