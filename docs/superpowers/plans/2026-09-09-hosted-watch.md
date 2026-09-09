# Hosted watch (deadlatch.dev /app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the hosted side of the live monitor at deadlatch.dev under `/app`. Sign in, create a project, get a key, point a monitor at it, see its flags with full offender detail, and get one email when the first flag lands after a quiet period.

**Architecture:** The existing Next.js site gains a protected `/app` area and two API routes, nothing else on the public site changes. Clerk for sign-in, Neon Postgres through Drizzle for storage, Resend for the one email, all provisioned through the Vercel marketplace so the environment variables arrive by themselves. Every piece of logic lives in `lib/watch/` as plain functions that take a database handle, so the API routes and the pages are thin and the tests run against PGlite through Drizzle's own driver with the real migrations. The wire contract is the one `@olurabian/tripwire@0.2.1`'s `deadlatchSink` already speaks and the broker monitor already sends.

**Tech Stack:** Next.js 16 (App Router, Node runtime), React 19, TypeScript strict, `@clerk/nextjs` 7, `drizzle-orm` with `@neondatabase/serverless` in production and `@electric-sql/pglite` in tests, `drizzle-kit` for migrations, `resend`, `vitest`.

**Spec:** `../../../tripwire/docs/superpowers/specs/2026-09-09-live-monitor-design.md` (the tripwire repository), Part 3 "the hosted service", plus Part 1 for the `Flag` shape and Part 2 for the monitor's side of the wire. Plan 3 of three.

## Global Constraints

- The public site is unchanged for a visitor. Middleware protects `/app` and `/api/v1` only; every other route stays static. The crawl of the public pages before and after must match (status and title for `/`, `/audit`, `/log`, each log post, `/robots.txt`, `/sitemap.xml`, and a 404).
- A project key is `dl_live_` plus 32 random bytes base64url, shown once, stored only as its sha256 hex; lists show the first eight characters after `dl_live_`. The plain key never reaches a log, a URL, or the database.
- `POST /api/v1/flags` and `POST /api/v1/heartbeat` run on the Node runtime, accept `Authorization: Bearer <key>`, and answer 401 for an unknown key, 403 for a revoked one, 413 over 100 flags or 1 MB, 422 for a malformed body with the first failing index and field, 202 with `{ accepted, duplicates }` (flags) or 204 (heartbeat). Inserts are `on conflict (id) do nothing`. The project is always the key's project, never a body field.
- The flags body is `{ monitor: { version, stream, intervalMs }, flags }` and the heartbeat body is `{ version, stream, intervalMs, cursor, lastFlagAt }`, exactly what `deadlatchSink` posts.
- One alert email per project per quiet period (default six hours), decided by the `alerts` table's primary key, sent through Resend, plain text, no tracking. Sender is `ALERT_FROM`, defaulting to Resend's onboarding sender until deadlatch.dev is verified in Resend.
- Fake keys in tests are low-entropy strings (gitleaks). Real keys are never committed; `.env.local` stays ignored.
- Prose in any README or doc carries no colons and no em dashes outside code, inline code, table rows and URLs. No counterparty names.
- Nothing is pushed to `main`, deployed, or provisioned before the task that says so. Provisioning (Task 1) runs only after ARABA's OK because it creates resources on the Vercel account. The deploy (Task 8) runs only on ARABA's go. `main` is protected; push to a branch, wait for `gitleaks (secrets)`, fast-forward `main`.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Decisions taken in this plan

1. Next.js moves from 15.1 to 16, because Clerk 7 requires 15.2.8 or newer and outreach-engine already runs 16. `next lint` no longer exists in 16, so the lint script becomes a typecheck.
2. Logic lives in `lib/watch/*` as functions of a `Db` handle; routes and pages call them. Tests use PGlite with the generated migrations, so the schema the tests run is the schema production runs.
3. Sign-in uses Clerk's hosted account portal (no sign-in pages in this repo). `auth.protect()` in the middleware redirects there.
4. The created key is shown once by a client form through a server action's returned state, never through a URL.
5. ARABA's reference project is created by a bootstrap script that writes the key straight into the Fly secret, so the key never appears in chat.

---

### Task 1: Provision Neon, Clerk and Resend through the marketplace (controller-run, on ARABA's OK)

**Files:** none in the repository. `.env.local` (ignored) gains the pulled variables.

- [ ] **Step 1: Install the three integrations** (from the repository root, project already linked)

```bash
npx vercel integration add neon --yes --no-claim
npx vercel integration add clerk --yes --no-claim
npx vercel integration add resend/resend-email --yes --no-claim
```

If any of them hands off to a browser step, stop and ask ARABA to complete it, then continue. Never echo a value.

- [ ] **Step 2: Pull the environment and record the variable names**

```bash
npx vercel env pull .env.local --yes
grep -oE "^[A-Z_]+" .env.local | sort
```

Expected to include `DATABASE_URL` (Neon), `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk), and `RESEND_API_KEY` (Resend). If the names differ, write the actual names into the ledger; Task 3 and Task 5 read them from there.

- [ ] **Step 3: Confirm `.env.local` is ignored**

```bash
git check-ignore .env.local && echo ignored
```

---

### Task 2: Next 16, dependencies, test runner, middleware, provider

**Files:**
- Modify: `package.json`, `app/layout.tsx`, `app/robots.ts`, `components/SiteNav.tsx`
- Create: `middleware.ts`, `vitest.config.ts`, `scripts/crawl.mjs`
- Test: `test/smoke.test.ts`

**Interfaces:**
- Produces: the protected `/app` and `/api/v1` matcher, `ClerkProvider` around the tree, `npm test`, `npm run crawl`.

- [ ] **Step 1: Crawl the public site before touching anything**

`scripts/crawl.mjs`:

```js
// Crawl the public pages of a running site and print status and title per path. Used before and after the upgrade.
const origin = process.argv[2] ?? "http://localhost:3000";
const paths = ["/", "/audit", "/log", "/log/confused-deputy", "/log/a-log-is-not-proof", "/log/the-head-leaves-the-building", "/robots.txt", "/sitemap.xml", "/nope-404"];
for (const p of paths) {
  const r = await fetch(origin + p, { redirect: "manual" });
  const text = await r.text();
  const title = /<title>([^<]*)<\/title>/.exec(text)?.[1] ?? "";
  console.log(`${r.status} ${p} ${title}`);
}
```

Run: `npm run build && (npx next start -p 3123 & sleep 6; node scripts/crawl.mjs http://localhost:3123 > crawl-before.txt; kill %1)` then `cat crawl-before.txt`. Keep `crawl-before.txt` out of git (add it to `.gitignore` together with `crawl-after.txt`).

- [ ] **Step 2: Upgrade and add dependencies**

```bash
npm install next@16 react@19 react-dom@19 @clerk/nextjs@7 drizzle-orm@0.45 @neondatabase/serverless@1 resend@6 --no-audit --no-fund
npm install -D drizzle-kit@0.31 vitest@4 @electric-sql/pglite@0.5 dotenv@17 tsx@4 @types/react@19 @types/react-dom@19 --no-audit --no-fund
```

If a pinned version does not resolve, install the newest stable release of that package instead and note the version in the report. Confirm `@clerk/nextjs`'s peer range accepts the installed `next` (`npm ls next @clerk/nextjs`).

In `package.json` set the scripts to:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "crawl": "node scripts/crawl.mjs",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx lib/db/migrate.ts"
  },
```

- [ ] **Step 3: Middleware, provider, nav, robots**

`middleware.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the app and the ingest API are behind Clerk. The API routes check their own bearer key and must not be redirected to sign-in, so they are matched but not protected.
const isApp = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isApp(req)) await auth.protect();
});

export const config = { matcher: ["/app(.*)", "/api/v1/(.*)"] };
```

`app/layout.tsx`: import `ClerkProvider` from `@clerk/nextjs` and wrap the `<html>` element: `<ClerkProvider>{/* existing html */}</ClerkProvider>`. Nothing else changes.

`components/SiteNav.tsx`: after `<Link href="/log">Log</Link>` add `<Link href="/app">App</Link>`.

`app/robots.ts`: add `disallow: ["/app", "/api"]` to the rule (keep `allow: "/"` and the sitemap line as they are). Read the file first and keep its shape.

- [ ] **Step 4: Test runner and a smoke test**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 20000 },
  resolve: { alias: { "@": new URL("./", import.meta.url).pathname } },
});
```

`test/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test` → 1 passing. Run: `npm run lint` → clean (fix any type errors the Next 16 upgrade surfaces, and list them in the report).

- [ ] **Step 5: Build and crawl after**

The build needs Clerk's publishable key at build time for the provider. Run: `npm run build` with `.env.local` present (Next reads it). Then start on 3123 and `node scripts/crawl.mjs http://localhost:3123 > crawl-after.txt`, and `diff crawl-before.txt crawl-after.txt` must be empty. Paste both crawls in the report.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json middleware.ts vitest.config.ts scripts/crawl.mjs test/smoke.test.ts app/layout.tsx app/robots.ts components/SiteNav.tsx .gitignore
git commit -m "app: Next 16, Clerk middleware on /app, test runner, public crawl script

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Schema, migrations, database client, keys

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `lib/db/types.ts`, `lib/db/migrate.ts`, `lib/db/test.ts`, `drizzle.config.ts`, `lib/watch/keys.ts`
- Generated: `drizzle/0000_*.sql` and `drizzle/meta/*` (committed)
- Test: `test/keys.test.ts`, `test/schema.test.ts`

**Interfaces:**
- Produces: the five tables as Drizzle objects; `Db` type; `db` (production); `testDb()` (PGlite with migrations applied); `newProjectKey()`, `hashKey(key)`, `keyPrefix(key)`, `KEY_PREFIX`.

- [ ] **Step 1: Failing tests**

`test/keys.test.ts`:

```ts
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
```

`test/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "@/lib/db/test";
import { projects, projectKeys, monitors, flags, alerts } from "@/lib/db/schema";

describe("schema", () => {
  it("applies the migrations and round-trips a project, a key, a monitor, a flag and an alert", async () => {
    const db = await testDb();
    const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "ref", stream: "purse" }).returning();
    expect(p.alertQuietMs).toBe(21_600_000);
    await db.insert(projectKeys).values({ projectId: p.id, prefix: "aaaabbbb", hash: "h".repeat(64) });
    await db.insert(monitors).values({ projectId: p.id, version: "0.3.1", stream: "purse", cursorSeq: 6, intervalMs: 60000 });
    const flag = { id: "f".repeat(64), projectId: p.id, expectationId: "executed-once", reason: "twice", offender: { action: "executed" }, cause: { amount: 1 }, ref: { stream: "purse", seq: 6, id: "x", hash: "0".repeat(64), ts: "2026-09-09T00:00:00.000Z" }, window: { fromSeq: 1, toSeq: 6, count: 6, matched: [] }, at: new Date("2026-09-09T00:00:00.000Z") };
    await db.insert(flags).values(flag);
    const dup = await db.insert(flags).values(flag).onConflictDoNothing().returning({ id: flags.id });
    expect(dup).toHaveLength(0);
    await db.insert(alerts).values({ projectId: p.id, flagId: flag.id });
    const again = await db.insert(alerts).values({ projectId: p.id, flagId: flag.id }).onConflictDoNothing().returning({ flagId: alerts.flagId });
    expect(again).toHaveLength(0);
    const [m] = await db.select().from(monitors).where(eq(monitors.projectId, p.id));
    expect(m.cursorSeq).toBe(6);
    const [k] = await db.select().from(projectKeys).where(eq(projectKeys.projectId, p.id));
    expect(k.revokedAt).toBeNull();
  });
  it("cascades a project's rows when the project is deleted", async () => {
    const db = await testDb();
    const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "ref", stream: "purse" }).returning();
    await db.insert(projectKeys).values({ projectId: p.id, prefix: "aaaabbbb", hash: "g".repeat(64) });
    await db.delete(projects).where(eq(projects.id, p.id));
    expect(await db.select().from(projectKeys)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test` → the two new files fail to import.

- [ ] **Step 3: Schema**

`lib/db/schema.ts`:

```ts
import { bigint, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    stream: text("stream").notNull(),
    alertQuietMs: integer("alert_quiet_ms").notNull().default(21_600_000),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("projects_owner").on(t.ownerId)],
);

export const projectKeys = pgTable("project_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const monitors = pgTable("monitors", {
  projectId: uuid("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  version: text("version"),
  stream: text("stream"),
  cursorSeq: bigint("cursor_seq", { mode: "number" }),
  intervalMs: integer("interval_ms"),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  lastPushAt: timestamp("last_push_at", { withTimezone: true }),
  lastFlagAt: timestamp("last_flag_at", { withTimezone: true }),
});

export const flags = pgTable(
  "flags",
  {
    id: text("id").primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    expectationId: text("expectation_id").notNull(),
    reason: text("reason").notNull(),
    offender: jsonb("offender").notNull(),
    cause: jsonb("cause"),
    ref: jsonb("ref").notNull(),
    window: jsonb("window").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (t) => [index("flags_project_received").on(t.projectId, t.receivedAt), index("flags_project_expectation").on(t.projectId, t.expectationId)],
);

export const alerts = pgTable(
  "alerts",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    flagId: text("flag_id").notNull().references(() => flags.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.flagId] }), index("alerts_project_sent").on(t.projectId, t.sentAt)],
);
```

`lib/db/types.ts`:

```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any Drizzle Postgres database over our schema, the Neon one in production and the PGlite one in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
```

If TypeScript refuses to pass the Neon or PGlite database where `Db` is expected, change the first type argument to `any` with a one-line comment saying why, and say so in the report.

`lib/db/client.ts` (the outreach-engine lazy proxy, verbatim pattern):

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type NeonDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: NeonDb | null = null;
function getDb(): NeonDb {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Lazy, so importing this module never opens a connection and pages that do not touch the database build without one.
export const db = new Proxy({} as NeonDb, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
```

`lib/db/test.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/** A fresh in-process Postgres with the real migrations applied. One per test. */
export async function testDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}
```

`lib/db/migrate.ts`:

```ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

`drizzle.config.ts`:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://unused" },
} satisfies Config;
```

- [ ] **Step 4: Keys**

`lib/watch/keys.ts`:

```ts
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
```

- [ ] **Step 5: Generate the migration, run the tests**

Run: `npm run db:generate` → one file under `drizzle/` plus `drizzle/meta/`. Open the SQL and confirm five tables, the two unique constraints (`project_keys.hash`, `flags.id` as primary key) and the `alerts` composite primary key.

Run: `npm test` → 4 passing. `npm run lint` clean.

- [ ] **Step 6: Commit**

```bash
git add lib/db lib/watch/keys.ts drizzle drizzle.config.ts test/keys.test.ts test/schema.test.ts
git commit -m "app: schema, migrations, database client, project keys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Ingest and heartbeat, the two API routes

**Files:**
- Create: `lib/watch/flag-shape.ts`, `lib/watch/ingest.ts`, `app/api/v1/flags/route.ts`, `app/api/v1/heartbeat/route.ts`
- Test: `test/ingest.test.ts`

**Interfaces:**
- Consumes: `Db`, tables, `hashKey`.
- Produces: `validateFlag(x, i): { field: string } | null`; `resolveKey(db, authorization): Promise<{ status: 401 | 403 } | { projectId: string }>`; `ingestFlags(db, authorization, raw, byteLength, now?) → { status, body, projectId?, newIds? }`; `heartbeat(db, authorization, raw, now?) → { status, body? }`.

- [ ] **Step 1: Failing tests**

`test/ingest.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "@/lib/db/test";
import { projects, projectKeys, flags, monitors } from "@/lib/db/schema";
import { hashKey, keyPrefix } from "@/lib/watch/keys";
import { ingestFlags, heartbeat, validateFlag } from "@/lib/watch/ingest";

const KEY = "dl_live_aaaaaaaabbbbccccdddd";
const REVOKED = "dl_live_eeeeeeeeffffgggghhhh";
const ISO = "2026-09-09T12:00:00.000Z";
const NOW = () => new Date("2026-09-09T12:05:00.000Z");

function flag(seq: number, expectation = "executed-once") {
  const ref = { stream: "purse", seq, id: `id-${seq}`, hash: "a".repeat(64), ts: ISO };
  return { v: 1, id: `${seq}`.padStart(64, "0"), expectation: { id: expectation, reason: "A single-use grant executed twice." }, offender: { action: "executed", input: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, outcome: "ok", ref }, cause: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, window: { fromSeq: 1, toSeq: seq, count: seq, matched: [ref] }, at: ISO };
}
const body = (list: unknown[]) => ({ monitor: { version: "0.3.1", stream: "purse", intervalMs: 60000 }, flags: list });
const size = (x: unknown) => Buffer.byteLength(JSON.stringify(x));

let db: Awaited<ReturnType<typeof testDb>>;
let projectId: string;
beforeEach(async () => {
  db = await testDb();
  const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "ref", stream: "purse" }).returning();
  projectId = p.id;
  await db.insert(projectKeys).values({ projectId, prefix: keyPrefix(KEY), hash: hashKey(KEY) });
  await db.insert(projectKeys).values({ projectId, prefix: keyPrefix(REVOKED), hash: hashKey(REVOKED), revokedAt: new Date() });
});

describe("validateFlag", () => {
  it("accepts a real flag and names the first wrong field", () => {
    expect(validateFlag(flag(1), 0)).toBeNull();
    expect(validateFlag({ ...flag(1), id: "short" }, 0)).toEqual({ field: "id" });
    expect(validateFlag({ ...flag(1), expectation: { id: 3 } }, 0)).toEqual({ field: "expectation.id" });
    expect(validateFlag({ ...flag(1), offender: { action: "x" } }, 0)).toEqual({ field: "offender.ref" });
    expect(validateFlag({ ...flag(1), at: "yesterday" }, 0)).toEqual({ field: "at" });
    expect(validateFlag({ ...flag(1), window: { fromSeq: 1 } }, 0)).toEqual({ field: "window.toSeq" });
    expect(validateFlag(null, 0)).toEqual({ field: "" });
  });
});

describe("ingestFlags", () => {
  it("stores a batch under the key's project, answers 202 with accepted and duplicates, and updates the monitor", async () => {
    const r = await ingestFlags(db, `Bearer ${KEY}`, body([flag(1), flag(2)]), size(body([flag(1), flag(2)])), NOW);
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ accepted: 2, duplicates: 0 });
    expect(r.projectId).toBe(projectId);
    expect(r.newIds).toEqual([flag(1).id, flag(2).id]);
    const rows = await db.select().from(flags).where(eq(flags.projectId, projectId));
    expect(rows.map((x) => x.expectationId)).toEqual(["executed-once", "executed-once"]);
    expect(rows[0].at.toISOString()).toBe(ISO);
    const [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
    expect(m.version).toBe("0.3.1");
    expect(m.lastPushAt?.toISOString()).toBe(NOW().toISOString());
    expect(m.lastFlagAt?.toISOString()).toBe(ISO);
  });
  it("collapses a replayed batch to duplicates and reports no new ids", async () => {
    await ingestFlags(db, `Bearer ${KEY}`, body([flag(1)]), 10, NOW);
    const r = await ingestFlags(db, `Bearer ${KEY}`, body([flag(1), flag(3)]), 10, NOW);
    expect(r.body).toEqual({ accepted: 1, duplicates: 1 });
    expect(r.newIds).toEqual([flag(3).id]);
  });
  it("answers 401 for no key, a wrong key, or a malformed header, and 403 for a revoked key", async () => {
    expect((await ingestFlags(db, null, body([flag(1)]), 10, NOW)).status).toBe(401);
    expect((await ingestFlags(db, "Bearer dl_live_nope", body([flag(1)]), 10, NOW)).status).toBe(401);
    expect((await ingestFlags(db, `Token ${KEY}`, body([flag(1)]), 10, NOW)).status).toBe(401);
    expect((await ingestFlags(db, `Bearer ${REVOKED}`, body([flag(1)]), 10, NOW)).status).toBe(403);
    expect(await db.select().from(flags)).toHaveLength(0);
  });
  it("answers 413 over a megabyte or over a hundred flags, before touching the database", async () => {
    expect((await ingestFlags(db, `Bearer ${KEY}`, body([flag(1)]), 1_000_001, NOW)).status).toBe(413);
    const many = Array.from({ length: 101 }, (_, i) => flag(i + 1));
    expect((await ingestFlags(db, `Bearer ${KEY}`, body(many), 10, NOW)).status).toBe(413);
    expect(await db.select().from(flags)).toHaveLength(0);
  });
  it("answers 422 naming the first failing flag and field, and stores nothing from that batch", async () => {
    const r = await ingestFlags(db, `Bearer ${KEY}`, body([flag(1), { ...flag(2), at: "nope" }]), 10, NOW);
    expect(r.status).toBe(422);
    expect(r.body).toEqual({ error: "malformed flag", index: 1, field: "at" });
    expect(await db.select().from(flags)).toHaveLength(0);
    expect((await ingestFlags(db, `Bearer ${KEY}`, { flags: "x" }, 10, NOW)).body).toEqual({ error: "flags must be an array" });
    expect((await ingestFlags(db, `Bearer ${KEY}`, "not an object", 10, NOW)).status).toBe(422);
  });
  it("never lets the body choose the project", async () => {
    const [other] = await db.insert(projects).values({ ownerId: "user_b", name: "other", stream: "purse" }).returning();
    const r = await ingestFlags(db, `Bearer ${KEY}`, { ...body([flag(1)]), projectId: other.id, project: other.id }, 10, NOW);
    expect(r.status).toBe(202);
    const rows = await db.select().from(flags);
    expect(rows[0].projectId).toBe(projectId);
  });
});

describe("heartbeat", () => {
  it("upserts the monitor row and answers 204", async () => {
    const hb = { version: "0.3.1", stream: "purse", intervalMs: 60000, cursor: { seq: 6 }, lastFlagAt: null };
    expect((await heartbeat(db, `Bearer ${KEY}`, hb, NOW)).status).toBe(204);
    let [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
    expect(m.cursorSeq).toBe(6);
    expect(m.lastHeartbeatAt?.toISOString()).toBe(NOW().toISOString());
    expect(m.lastFlagAt).toBeNull();
    expect((await heartbeat(db, `Bearer ${KEY}`, { ...hb, cursor: { seq: 9 }, lastFlagAt: ISO }, NOW)).status).toBe(204);
    [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
    expect(m.cursorSeq).toBe(9);
    expect(m.lastFlagAt?.toISOString()).toBe(ISO);
  });
  it("answers 401, 403 and 422 like the flags route", async () => {
    expect((await heartbeat(db, null, {}, NOW)).status).toBe(401);
    expect((await heartbeat(db, `Bearer ${REVOKED}`, {}, NOW)).status).toBe(403);
    expect((await heartbeat(db, `Bearer ${KEY}`, { version: 1 }, NOW)).status).toBe(422);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test` → `test/ingest.test.ts` fails to import.

- [ ] **Step 3: The flag shape**

`lib/watch/flag-shape.ts`:

```ts
/** The wire shape of a flag, as @olurabian/tripwire/monitor emits it. Checked field by field; the first wrong field is named. */
export interface WireRef { stream: string; seq: number; id: string; hash: string; ts: string }
export interface WireFlag {
  v: 1;
  id: string;
  expectation: { id: string; reason: string };
  offender: { action: string; ref: WireRef; [k: string]: unknown };
  cause: unknown;
  window: { fromSeq: number; toSeq: number; count: number; matched: WireRef[] };
  at: string;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isIso = (x: unknown): x is string => isStr(x) && !Number.isNaN(Date.parse(x));

function badRef(r: unknown): string | null {
  if (!isObj(r)) return "";
  if (!isStr(r.stream)) return "stream";
  if (!isNum(r.seq)) return "seq";
  if (!isStr(r.id)) return "id";
  if (!isStr(r.hash)) return "hash";
  if (!isIso(r.ts)) return "ts";
  return null;
}

/** Null when the value is a well-formed flag, otherwise the first failing field as a dotted path ("" for a non-object). */
export function validateFlag(x: unknown): { field: string } | null {
  if (!isObj(x)) return { field: "" };
  if (x.v !== 1) return { field: "v" };
  if (!isStr(x.id) || !/^[0-9a-f]{64}$/.test(x.id)) return { field: "id" };
  if (!isObj(x.expectation)) return { field: "expectation" };
  if (!isStr(x.expectation.id)) return { field: "expectation.id" };
  if (!isStr(x.expectation.reason)) return { field: "expectation.reason" };
  if (!isObj(x.offender)) return { field: "offender" };
  if (!isStr(x.offender.action)) return { field: "offender.action" };
  const refField = badRef(x.offender.ref);
  if (refField !== null) return { field: refField ? `offender.ref.${refField}` : "offender.ref" };
  if (!isObj(x.window)) return { field: "window" };
  if (!isNum(x.window.fromSeq)) return { field: "window.fromSeq" };
  if (!isNum(x.window.toSeq)) return { field: "window.toSeq" };
  if (!isNum(x.window.count)) return { field: "window.count" };
  if (!Array.isArray(x.window.matched)) return { field: "window.matched" };
  for (const [i, m] of x.window.matched.entries()) {
    const f = badRef(m);
    if (f !== null) return { field: f ? `window.matched.${i}.${f}` : `window.matched.${i}` };
  }
  if (!isIso(x.at)) return { field: "at" };
  return null;
}
```

- [ ] **Step 4: Ingest and heartbeat**

`lib/watch/ingest.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/types";
import { flags, monitors, projectKeys } from "@/lib/db/schema";
import { hashKey, KEY_PREFIX } from "./keys";
import { validateFlag as validateShape, type WireFlag } from "./flag-shape";

export const MAX_FLAGS = 100;
export const MAX_BYTES = 1_000_000;

export type KeyResolution = { status: 401 | 403 } | { projectId: string };

/** The project behind a bearer key. 401 when absent, malformed, or unknown; 403 when revoked. */
export async function resolveKey(db: Db, authorization: string | null): Promise<KeyResolution> {
  if (!authorization?.startsWith("Bearer ")) return { status: 401 };
  const key = authorization.slice(7).trim();
  if (!key.startsWith(KEY_PREFIX)) return { status: 401 };
  const [row] = await db.select({ projectId: projectKeys.projectId, revokedAt: projectKeys.revokedAt }).from(projectKeys).where(eq(projectKeys.hash, hashKey(key)));
  if (!row) return { status: 401 };
  if (row.revokedAt) return { status: 403 };
  return { projectId: row.projectId };
}

/** Re-exported so the tests and the route name one function. The index argument is accepted for symmetry and unused. */
export function validateFlag(x: unknown, _index?: number): { field: string } | null {
  return validateShape(x);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

interface MonitorMeta { version: string | null; stream: string | null; intervalMs: number | null }
function monitorMeta(raw: Record<string, unknown>): MonitorMeta {
  const m = isObj(raw.monitor) ? raw.monitor : {};
  return {
    version: typeof m.version === "string" ? m.version : null,
    stream: typeof m.stream === "string" ? m.stream : null,
    intervalMs: typeof m.intervalMs === "number" ? m.intervalMs : null,
  };
}

export interface IngestResult { status: number; body: unknown; projectId?: string; newIds?: string[] }

export async function ingestFlags(db: Db, authorization: string | null, raw: unknown, byteLength: number, now: () => Date = () => new Date()): Promise<IngestResult> {
  if (byteLength > MAX_BYTES) return { status: 413, body: { error: `body over ${MAX_BYTES} bytes` } };
  const key = await resolveKey(db, authorization);
  if ("status" in key) return { status: key.status, body: { error: key.status === 401 ? "unknown key" : "revoked key" } };
  if (!isObj(raw)) return { status: 422, body: { error: "body must be an object" } };
  if (!Array.isArray(raw.flags)) return { status: 422, body: { error: "flags must be an array" } };
  if (raw.flags.length > MAX_FLAGS) return { status: 413, body: { error: `at most ${MAX_FLAGS} flags per request` } };
  for (const [index, f] of raw.flags.entries()) {
    const bad = validateShape(f);
    if (bad) return { status: 422, body: { error: "malformed flag", index, field: bad.field } };
  }
  const list = raw.flags as WireFlag[];
  const at = now();
  let inserted: { id: string }[] = [];
  if (list.length > 0) {
    inserted = await db
      .insert(flags)
      .values(list.map((f) => ({ id: f.id, projectId: key.projectId, expectationId: f.expectation.id, reason: f.expectation.reason, offender: f.offender, cause: f.cause ?? null, ref: f.offender.ref, window: f.window, at: new Date(f.at) })))
      .onConflictDoNothing()
      .returning({ id: flags.id });
  }
  const newest = list.reduce<Date | null>((m, f) => { const d = new Date(f.at); return m && m > d ? m : d; }, null);
  const meta = monitorMeta(raw);
  await db
    .insert(monitors)
    .values({ projectId: key.projectId, version: meta.version, stream: meta.stream, intervalMs: meta.intervalMs, lastPushAt: at, lastFlagAt: newest })
    .onConflictDoUpdate({
      target: monitors.projectId,
      set: { version: meta.version, stream: meta.stream, intervalMs: meta.intervalMs, lastPushAt: at, lastFlagAt: sql`greatest(coalesce(${monitors.lastFlagAt}, 'epoch'::timestamptz), coalesce(excluded.last_flag_at, 'epoch'::timestamptz))` },
    });
  const newIds = inserted.map((r) => r.id);
  return { status: 202, body: { accepted: newIds.length, duplicates: list.length - newIds.length }, projectId: key.projectId, newIds };
}

export interface HeartbeatResult { status: number; body?: unknown }

export async function heartbeat(db: Db, authorization: string | null, raw: unknown, now: () => Date = () => new Date()): Promise<HeartbeatResult> {
  const key = await resolveKey(db, authorization);
  if ("status" in key) return { status: key.status, body: { error: key.status === 401 ? "unknown key" : "revoked key" } };
  if (!isObj(raw)) return { status: 422, body: { error: "body must be an object" } };
  if (typeof raw.version !== "string" || typeof raw.stream !== "string" || typeof raw.intervalMs !== "number") return { status: 422, body: { error: "version, stream and intervalMs are required" } };
  const cursor = isObj(raw.cursor) && typeof raw.cursor.seq === "number" ? raw.cursor.seq : null;
  const lastFlagAt = typeof raw.lastFlagAt === "string" && !Number.isNaN(Date.parse(raw.lastFlagAt)) ? new Date(raw.lastFlagAt) : null;
  const at = now();
  await db
    .insert(monitors)
    .values({ projectId: key.projectId, version: raw.version, stream: raw.stream, intervalMs: raw.intervalMs, cursorSeq: cursor, lastHeartbeatAt: at, lastFlagAt })
    .onConflictDoUpdate({ target: monitors.projectId, set: { version: raw.version, stream: raw.stream, intervalMs: raw.intervalMs, cursorSeq: cursor, lastHeartbeatAt: at, lastFlagAt: sql`coalesce(excluded.last_flag_at, ${monitors.lastFlagAt})` } });
  return { status: 204 };
}
```

Note the `greatest(...)` expression keeps the newest flag time across batches; if PGlite rejects the `'epoch'::timestamptz` literal, use `to_timestamp(0)` in both places and say so in the report.

- [ ] **Step 5: The routes**

`app/api/v1/flags/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { ingestFlags } from "@/lib/watch/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const text = await req.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 422 });
  }
  const r = await ingestFlags(db, req.headers.get("authorization"), raw, Buffer.byteLength(text, "utf8"));
  return NextResponse.json(r.body, { status: r.status });
}
```

`app/api/v1/heartbeat/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { heartbeat } from "@/lib/watch/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 422 });
  }
  const r = await heartbeat(db, req.headers.get("authorization"), raw);
  return r.status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(r.body, { status: r.status });
}
```

The alert hook is added to the flags route in Task 5.

- [ ] **Step 6: Run, typecheck, commit**

Run: `npm test` → all passing (4 + 10). `npm run lint` clean. `npm run build` succeeds (the routes compile; no database is touched at build time).

```bash
git add lib/watch/flag-shape.ts lib/watch/ingest.ts app/api/v1 test/ingest.test.ts
git commit -m "app: ingest and heartbeat, the two API routes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The alert

**Files:**
- Create: `lib/watch/alert.ts`, `lib/watch/mailer.ts`, `lib/watch/owner.ts`
- Modify: `app/api/v1/flags/route.ts`
- Test: `test/alert.test.ts`

**Interfaces:**
- Produces: `Mailer { send({ to, subject, text }) }`; `resendMailer()`; `ownerEmail(ownerId): Promise<string | null>` (Clerk); `maybeAlert(db, mailer, lookupEmail, projectId, flagIds, now?, origin?) → { sent: boolean; flagId?: string }`.

- [ ] **Step 1: Failing tests**

`test/alert.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "@/lib/db/test";
import { projects, flags, alerts } from "@/lib/db/schema";
import { maybeAlert, type Mailer } from "@/lib/watch/alert";

const ISO = "2026-09-09T12:00:00.000Z";
function fakeMailer(fail = false) {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const mailer: Mailer = { async send(m) { if (fail) throw new Error("resend down"); sent.push(m); } };
  return { mailer, sent };
}
const email = async (ownerId: string) => (ownerId === "user_a" ? "araba@example.com" : null);

let db: Awaited<ReturnType<typeof testDb>>;
let projectId: string;
beforeEach(async () => {
  db = await testDb();
  const [p] = await db.insert(projects).values({ ownerId: "user_a", name: "reference broker", stream: "purse", alertQuietMs: 6 * 3_600_000 }).returning();
  projectId = p.id;
  for (const n of [1, 2, 3]) {
    const ref = { stream: "purse", seq: n, id: `id-${n}`, hash: "a".repeat(64), ts: ISO };
    await db.insert(flags).values({ id: `${n}`.padStart(64, "0"), projectId, expectationId: "payee-velocity", reason: "The same payee was paid too many times too quickly.", offender: { action: "executed", input: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, outcome: "ok", ref }, cause: { amount: { amount: 1250, currency: "USD" }, payee: "api.stripe.com" }, ref, window: { fromSeq: 1, toSeq: n, count: n, matched: [] }, at: new Date(ISO) });
  }
});

describe("maybeAlert", () => {
  it("sends one plain email for the first flag after silence, records it, and names the expectation, the payee, the amount, the seq and the link", async () => {
    const { mailer, sent } = fakeMailer();
    const r = await maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], new Date("2026-09-09T12:00:10.000Z"), "https://www.deadlatch.dev");
    expect(r).toEqual({ sent: true, flagId: "1".padStart(64, "0") });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("araba@example.com");
    expect(sent[0].subject).toBe("Deadlatch, payee-velocity on reference broker");
    expect(sent[0].text).toContain("The same payee was paid too many times too quickly.");
    expect(sent[0].text).toContain("api.stripe.com");
    expect(sent[0].text).toContain("1250 USD");
    expect(sent[0].text).toContain("seq 1");
    expect(sent[0].text).toContain(`https://www.deadlatch.dev/app/${projectId}/flags/${"1".padStart(64, "0")}`);
    expect(await db.select().from(alerts)).toHaveLength(1);
  });
  it("stays quiet for the quiet period, then sends again", async () => {
    const { mailer, sent } = fakeMailer();
    await maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], new Date("2026-09-09T12:00:10.000Z"));
    const r2 = await maybeAlert(db, mailer, email, projectId, ["2".padStart(64, "0")], new Date("2026-09-09T15:00:00.000Z"));
    expect(r2).toEqual({ sent: false });
    const r3 = await maybeAlert(db, mailer, email, projectId, ["3".padStart(64, "0")], new Date("2026-09-09T18:00:11.000Z"));
    expect(r3.sent).toBe(true);
    expect(sent).toHaveLength(2);
  });
  it("picks the oldest flag of a batch and never sends twice for one flag", async () => {
    const { mailer, sent } = fakeMailer();
    await db.insert(alerts).values({ projectId, flagId: "2".padStart(64, "0"), sentAt: new Date("2026-09-09T05:00:00.000Z") });
    const r = await maybeAlert(db, mailer, email, projectId, ["2".padStart(64, "0"), "3".padStart(64, "0")], new Date("2026-09-09T12:00:00.000Z"));
    expect(r).toEqual({ sent: true, flagId: "3".padStart(64, "0") });
    expect(sent).toHaveLength(1);
  });
  it("does not record the alert when the provider fails, so the next flag retries", async () => {
    const { mailer } = fakeMailer(true);
    const r = await maybeAlert(db, mailer, email, projectId, ["1".padStart(64, "0")], new Date("2026-09-09T12:00:10.000Z"));
    expect(r).toEqual({ sent: false });
    expect(await db.select().from(alerts)).toHaveLength(0);
  });
  it("does nothing without an owner email or with no new flags", async () => {
    const { mailer, sent } = fakeMailer();
    const [p] = await db.insert(projects).values({ ownerId: "user_z", name: "x", stream: "s" }).returning();
    expect(await maybeAlert(db, mailer, email, p.id, ["1".padStart(64, "0")], new Date())).toEqual({ sent: false });
    expect(await maybeAlert(db, mailer, email, projectId, [], new Date())).toEqual({ sent: false });
    expect(sent).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test` → `test/alert.test.ts` fails to import.

- [ ] **Step 3: The alert, the mailer, the owner lookup**

`lib/watch/alert.ts`:

```ts
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/types";
import { alerts, flags, projects } from "@/lib/db/schema";

export interface Mailer { send(message: { to: string; subject: string; text: string }): Promise<void> }
export type OwnerEmail = (ownerId: string) => Promise<string | null>;

interface Money { amount: number; currency: string }
function describeCause(cause: unknown): string {
  const c = (cause ?? {}) as { payee?: string; amount?: Money };
  const parts: string[] = [];
  if (c.payee) parts.push(`payee ${c.payee}`);
  if (c.amount && typeof c.amount.amount === "number") parts.push(`${c.amount.amount} ${c.amount.currency ?? ""}`.trim());
  return parts.join(", ");
}

/**
 * One email per project per quiet period, on the first new flag after silence. The alerts table's primary key
 * is what makes a double send impossible under concurrent batches. A failed send removes the row so the next
 * flag retries.
 */
export async function maybeAlert(db: Db, mailer: Mailer, ownerEmail: OwnerEmail, projectId: string, flagIds: string[], now: Date = new Date(), origin = "https://www.deadlatch.dev"): Promise<{ sent: boolean; flagId?: string }> {
  if (flagIds.length === 0) return { sent: false };
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return { sent: false };
  const to = await ownerEmail(project.ownerId);
  if (!to) return { sent: false };
  const [last] = await db.select({ sentAt: alerts.sentAt }).from(alerts).where(eq(alerts.projectId, projectId)).orderBy(desc(alerts.sentAt)).limit(1);
  if (last && now.getTime() - last.sentAt.getTime() < project.alertQuietMs) return { sent: false };
  const alreadySent = new Set((await db.select({ flagId: alerts.flagId }).from(alerts).where(and(eq(alerts.projectId, projectId), inArray(alerts.flagId, flagIds)))).map((r) => r.flagId));
  const candidates = await db.select().from(flags).where(and(eq(flags.projectId, projectId), inArray(flags.id, flagIds.filter((id) => !alreadySent.has(id))))).orderBy(flags.at, flags.id);
  const flag = candidates[0];
  if (!flag) return { sent: false };
  const claimed = await db.insert(alerts).values({ projectId, flagId: flag.id, sentAt: now }).onConflictDoNothing().returning({ flagId: alerts.flagId });
  if (claimed.length === 0) return { sent: false };
  const link = `${origin}/app/${projectId}/flags/${flag.id}`;
  const ref = flag.ref as { seq?: number };
  const text = [
    `A flag landed on ${project.name}.`,
    "",
    `${flag.expectationId}. ${flag.reason}`,
    describeCause(flag.cause),
    `receipt seq ${ref.seq ?? "?"}`,
    "",
    link,
    "",
    "You get one of these per quiet period. Change the period in the project's settings.",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  try {
    await mailer.send({ to, subject: `Deadlatch, ${flag.expectationId} on ${project.name}`, text });
  } catch {
    await db.delete(alerts).where(and(eq(alerts.projectId, projectId), eq(alerts.flagId, flag.id)));
    return { sent: false };
  }
  return { sent: true, flagId: flag.id };
}
```

`lib/watch/mailer.ts`:

```ts
import { Resend } from "resend";
import type { Mailer } from "./alert";

/** Resend, from RESEND_API_KEY. The sender is ALERT_FROM, Resend's onboarding sender until deadlatch.dev is verified there. */
export function resendMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM ?? "Deadlatch <onboarding@resend.dev>";
  if (!key) return { async send() { /* no provider configured, the alert row is rolled back by the caller */ throw new Error("RESEND_API_KEY is not set"); } };
  const client = new Resend(key);
  return {
    async send({ to, subject, text }) {
      const r = await client.emails.send({ from, to, subject, text });
      if (r.error) throw new Error(r.error.message);
    },
  };
}
```

`lib/watch/owner.ts`:

```ts
import { clerkClient } from "@clerk/nextjs/server";

/** The owner's primary email from Clerk, or null when the user or the address is missing. */
export async function ownerEmail(ownerId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ownerId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
    return primary?.emailAddress ?? null;
  } catch {
    return null;
  }
}
```

If the installed Clerk exports `clerkClient` as a value rather than a function, call it without `await` and note it in the report.

- [ ] **Step 4: Hook the route**

In `app/api/v1/flags/route.ts`, add the imports `import { maybeAlert } from "@/lib/watch/alert"; import { resendMailer } from "@/lib/watch/mailer"; import { ownerEmail } from "@/lib/watch/owner";` and after the `ingestFlags` call:

```ts
  if (r.status === 202 && r.projectId && r.newIds && r.newIds.length > 0) {
    const origin = process.env.APP_ORIGIN ?? "https://www.deadlatch.dev";
    await maybeAlert(db, resendMailer(), ownerEmail, r.projectId, r.newIds, new Date(), origin).catch(() => undefined);
  }
```

The alert must never fail the ingest, hence the catch.

- [ ] **Step 5: Run, typecheck, commit**

Run: `npm test` → all passing (14 + 5). `npm run lint` clean. `npm run build` succeeds.

```bash
git add lib/watch/alert.ts lib/watch/mailer.ts lib/watch/owner.ts app/api/v1/flags/route.ts test/alert.test.ts
git commit -m "app: one alert per quiet period, through Resend, rolled back when the provider fails

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Queries, actions, and the four pages

**Files:**
- Create: `lib/watch/config-lines.ts`, `lib/watch/queries.ts`, `app/app/actions.ts`, `app/app/page.tsx`, `app/app/[project]/page.tsx`, `app/app/[project]/flags/[id]/page.tsx`, `app/app/[project]/settings/page.tsx`, `components/app/CreateProject.tsx`, `components/app/RotateKey.tsx`, `components/app/Acknowledge.tsx`
- Modify: `app/globals.css` (an `/* app */` block)
- Test: `test/queries.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `configLines(key | null, stream, origin)` (pure, in its own module); `projectsFor(db, ownerId)`, `createProject(db, ownerId, name, stream) → { project, key }`, `projectFor(db, ownerId, projectId)`, `dashboard(db, projectId, now) → { monitor: { state: "ok" | "amber" | "red" | "never", version, cursorSeq, lastHeartbeatAt, intervalMs }, counts: { day: Record<string, number>, week: Record<string, number> }, recent: FlagRow[] }`, `flagFor(db, projectId, flagId)`, `acknowledge(db, projectId, flagId, now)`, `rotateKey(db, projectId) → { key, prefix }`, `keyInfo(db, projectId) → { prefix, createdAt } | null`, `setQuiet(db, projectId, ms)`.

- [ ] **Step 1: Failing tests**

`test/queries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "@/lib/db/test";
import { projects, projectKeys, monitors, flags } from "@/lib/db/schema";
import { hashKey } from "@/lib/watch/keys";
import { projectsFor, createProject, projectFor, dashboard, flagFor, acknowledge, rotateKey, keyInfo, setQuiet } from "@/lib/watch/queries";
import { configLines } from "@/lib/watch/config-lines";

const NOW = new Date("2026-09-09T12:00:00.000Z");
let db: Awaited<ReturnType<typeof testDb>>;
beforeEach(async () => { db = await testDb(); });

async function seedFlags(projectId: string, list: Array<{ n: number; expectation: string; hoursAgo: number }>) {
  for (const f of list) {
    const at = new Date(NOW.getTime() - f.hoursAgo * 3_600_000);
    const ref = { stream: "purse", seq: f.n, id: `id-${f.n}`, hash: "a".repeat(64), ts: at.toISOString() };
    await db.insert(flags).values({ id: `${f.n}`.padStart(64, "0"), projectId, expectationId: f.expectation, reason: "r", offender: { action: "executed", ref }, cause: { payee: "api.stripe.com", amount: { amount: 1250, currency: "USD" } }, ref, window: { fromSeq: 1, toSeq: f.n, count: f.n, matched: [] }, at, receivedAt: at });
  }
}

describe("projects and keys", () => {
  it("creates a project with one key shown once, lists it for its owner only, and scopes lookups by owner", async () => {
    const { project, key } = await createProject(db, "user_a", "reference broker", "purse");
    expect(key.startsWith("dl_live_")).toBe(true);
    const [k] = await db.select().from(projectKeys).where(eq(projectKeys.projectId, project.id));
    expect(k.hash).toBe(hashKey(key));
    expect(k.prefix).toBe(key.slice(8, 16));
    expect((await projectsFor(db, "user_a")).map((p) => p.name)).toEqual(["reference broker"]);
    expect(await projectsFor(db, "user_b")).toEqual([]);
    expect((await projectFor(db, "user_a", project.id))?.id).toBe(project.id);
    expect(await projectFor(db, "user_b", project.id)).toBeNull();
  });
  it("rotates the key, revoking the old one, and keyInfo reports the live one", async () => {
    const { project, key } = await createProject(db, "user_a", "p", "purse");
    const rotated = await rotateKey(db, project.id);
    expect(rotated.key).not.toBe(key);
    const rows = await db.select().from(projectKeys).where(eq(projectKeys.projectId, project.id));
    expect(rows.filter((r) => r.revokedAt).map((r) => r.hash)).toEqual([hashKey(key)]);
    expect((await keyInfo(db, project.id))?.prefix).toBe(rotated.prefix);
    expect(configLines(rotated.key, "purse", "https://www.deadlatch.dev")).toBe(`DEADLATCH_URL=https://www.deadlatch.dev\nDEADLATCH_PROJECT_KEY=${rotated.key}\nMONITOR_STREAM=purse`);
    expect(configLines(null, "purse", "https://www.deadlatch.dev")).toContain("DEADLATCH_PROJECT_KEY=<shown once when the key was made>");
  });
  it("setQuiet bounds the period to one minute or more", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    await setQuiet(db, project.id, 3_600_000);
    expect((await projectFor(db, "user_a", project.id))?.alertQuietMs).toBe(3_600_000);
    await expect(setQuiet(db, project.id, 5)).rejects.toThrow(/at least/);
  });
});

describe("dashboard", () => {
  it("reports never before a heartbeat, then ok, amber past two intervals, red past three", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("never");
    await db.insert(monitors).values({ projectId: project.id, version: "0.3.1", stream: "purse", cursorSeq: 6, intervalMs: 60_000, lastHeartbeatAt: new Date(NOW.getTime() - 30_000) });
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("ok");
    await db.update(monitors).set({ lastHeartbeatAt: new Date(NOW.getTime() - 150_000) }).where(eq(monitors.projectId, project.id));
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("amber");
    await db.update(monitors).set({ lastHeartbeatAt: new Date(NOW.getTime() - 200_000) }).where(eq(monitors.projectId, project.id));
    expect((await dashboard(db, project.id, NOW)).monitor.state).toBe("red");
  });
  it("counts flags by expectation over a day and a week and lists the newest first", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    await seedFlags(project.id, [{ n: 1, expectation: "executed-once", hoursAgo: 1 }, { n: 2, expectation: "payee-velocity", hoursAgo: 2 }, { n: 3, expectation: "payee-velocity", hoursAgo: 30 }, { n: 4, expectation: "executed-once", hoursAgo: 200 }]);
    const d = await dashboard(db, project.id, NOW);
    expect(d.counts.day).toEqual({ "executed-once": 1, "payee-velocity": 1 });
    expect(d.counts.week).toEqual({ "executed-once": 1, "payee-velocity": 2 });
    expect(d.recent.map((f) => f.ref.seq)).toEqual([1, 2, 3, 4]);
    expect(d.recent[0].payee).toBe("api.stripe.com");
    expect(d.recent[0].amount).toBe("1250 USD");
  });
});

describe("flag detail", () => {
  it("returns a flag only within its project and acknowledges once", async () => {
    const { project } = await createProject(db, "user_a", "p", "purse");
    const other = await createProject(db, "user_b", "q", "purse");
    await seedFlags(project.id, [{ n: 1, expectation: "executed-once", hoursAgo: 1 }]);
    const id = "1".padStart(64, "0");
    expect((await flagFor(db, project.id, id))?.expectationId).toBe("executed-once");
    expect(await flagFor(db, other.project.id, id)).toBeNull();
    await acknowledge(db, project.id, id, NOW);
    expect((await flagFor(db, project.id, id))?.acknowledgedAt?.toISOString()).toBe(NOW.toISOString());
    await acknowledge(db, project.id, id, new Date(NOW.getTime() + 1000));
    expect((await flagFor(db, project.id, id))?.acknowledgedAt?.toISOString()).toBe(NOW.toISOString());
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test` → `test/queries.test.ts` fails to import.

- [ ] **Step 3: Queries**

`lib/watch/config-lines.ts` is pure, no database and no `node:` imports, so client components can use it:

```ts
/** The three lines a broker operator pastes. The key is only ever present right after it was made. */
export function configLines(key: string | null, stream: string, origin: string): string {
  return [`DEADLATCH_URL=${origin}`, `DEADLATCH_PROJECT_KEY=${key ?? "<shown once when the key was made>"}`, `MONITOR_STREAM=${stream}`].join("\n");
}
```

`lib/watch/queries.ts`:

```ts
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/types";
import { flags, monitors, projectKeys, projects } from "@/lib/db/schema";
import { hashKey, keyPrefix, newProjectKey } from "./keys";

export type Project = typeof projects.$inferSelect;
export type FlagRecord = typeof flags.$inferSelect;
export interface FlagRow { id: string; expectationId: string; reason: string; ref: { stream: string; seq: number; id: string; hash: string; ts: string }; payee: string | null; amount: string | null; at: Date; receivedAt: Date; acknowledgedAt: Date | null }

export async function projectsFor(db: Db, ownerId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(projects.createdAt);
}

export async function projectFor(db: Db, ownerId: string, projectId: string): Promise<Project | null> {
  const [p] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
  return p ?? null;
}

export async function createProject(db: Db, ownerId: string, name: string, stream: string): Promise<{ project: Project; key: string }> {
  const cleanName = name.trim().slice(0, 80);
  const cleanStream = stream.trim().slice(0, 80) || "purse";
  if (!cleanName) throw new Error("a project needs a name");
  const [project] = await db.insert(projects).values({ ownerId, name: cleanName, stream: cleanStream }).returning();
  const key = newProjectKey();
  await db.insert(projectKeys).values({ projectId: project.id, prefix: keyPrefix(key), hash: hashKey(key) });
  return { project, key };
}

export async function rotateKey(db: Db, projectId: string): Promise<{ key: string; prefix: string }> {
  const now = new Date();
  await db.update(projectKeys).set({ revokedAt: now }).where(and(eq(projectKeys.projectId, projectId), isNull(projectKeys.revokedAt)));
  const key = newProjectKey();
  const prefix = keyPrefix(key);
  await db.insert(projectKeys).values({ projectId, prefix, hash: hashKey(key) });
  return { key, prefix };
}

export async function keyInfo(db: Db, projectId: string): Promise<{ prefix: string; createdAt: Date } | null> {
  const [k] = await db.select({ prefix: projectKeys.prefix, createdAt: projectKeys.createdAt }).from(projectKeys).where(and(eq(projectKeys.projectId, projectId), isNull(projectKeys.revokedAt))).orderBy(desc(projectKeys.createdAt)).limit(1);
  return k ?? null;
}

export async function setQuiet(db: Db, projectId: string, ms: number): Promise<void> {
  if (!Number.isInteger(ms) || ms < 60_000) throw new Error("the quiet period must be at least one minute");
  await db.update(projects).set({ alertQuietMs: ms }).where(eq(projects.id, projectId));
}

interface Money { amount: number; currency: string }
function row(f: FlagRecord): FlagRow {
  const cause = (f.cause ?? {}) as { payee?: string; amount?: Money };
  return {
    id: f.id, expectationId: f.expectationId, reason: f.reason,
    ref: f.ref as FlagRow["ref"],
    payee: cause.payee ?? null,
    amount: cause.amount && typeof cause.amount.amount === "number" ? `${cause.amount.amount} ${cause.amount.currency ?? ""}`.trim() : null,
    at: f.at, receivedAt: f.receivedAt, acknowledgedAt: f.acknowledgedAt,
  };
}

export type MonitorState = "never" | "ok" | "amber" | "red";
export interface Dashboard {
  monitor: { state: MonitorState; version: string | null; cursorSeq: number | null; lastHeartbeatAt: Date | null; intervalMs: number | null };
  counts: { day: Record<string, number>; week: Record<string, number> };
  recent: FlagRow[];
}

async function countsSince(db: Db, projectId: string, since: Date): Promise<Record<string, number>> {
  const rows = await db.select({ expectationId: flags.expectationId, n: sql<number>`count(*)::int` }).from(flags).where(and(eq(flags.projectId, projectId), gte(flags.receivedAt, since))).groupBy(flags.expectationId);
  return Object.fromEntries(rows.map((r) => [r.expectationId, r.n]));
}

export async function dashboard(db: Db, projectId: string, now: Date = new Date()): Promise<Dashboard> {
  const [m] = await db.select().from(monitors).where(eq(monitors.projectId, projectId));
  let state: MonitorState = "never";
  if (m?.lastHeartbeatAt) {
    const interval = m.intervalMs ?? 60_000;
    const age = now.getTime() - m.lastHeartbeatAt.getTime();
    state = age > 3 * interval ? "red" : age > 2 * interval ? "amber" : "ok";
  }
  const day = await countsSince(db, projectId, new Date(now.getTime() - 24 * 3_600_000));
  const week = await countsSince(db, projectId, new Date(now.getTime() - 7 * 24 * 3_600_000));
  const recent = (await db.select().from(flags).where(eq(flags.projectId, projectId)).orderBy(desc(flags.receivedAt), desc(flags.id)).limit(50)).map(row);
  return { monitor: { state, version: m?.version ?? null, cursorSeq: m?.cursorSeq ?? null, lastHeartbeatAt: m?.lastHeartbeatAt ?? null, intervalMs: m?.intervalMs ?? null }, counts: { day, week }, recent };
}

export async function flagFor(db: Db, projectId: string, flagId: string): Promise<FlagRecord | null> {
  const [f] = await db.select().from(flags).where(and(eq(flags.projectId, projectId), eq(flags.id, flagId)));
  return f ?? null;
}

/** Sets acknowledgedAt once; a second call keeps the first time. */
export async function acknowledge(db: Db, projectId: string, flagId: string, now: Date = new Date()): Promise<void> {
  await db.update(flags).set({ acknowledgedAt: now }).where(and(eq(flags.projectId, projectId), eq(flags.id, flagId), isNull(flags.acknowledgedAt)));
}
```

Run: `npm test` → all passing (19 + 7). Fix the "recent" ordering test if `receivedAt` ties by falling back to `id` as written.

- [ ] **Step 4: Server actions**

`app/app/actions.ts`:

```ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { acknowledge, createProject, projectFor, rotateKey, setQuiet } from "@/lib/watch/queries";

async function owner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  return userId;
}

export interface KeyState { key: string | null; projectId: string | null; error: string | null }

export async function createProjectAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ownerId = await owner();
  try {
    const { project, key } = await createProject(db, ownerId, String(form.get("name") ?? ""), String(form.get("stream") ?? "purse"));
    revalidatePath("/app");
    return { key, projectId: project.id, error: null };
  } catch (e) {
    return { key: null, projectId: null, error: (e as Error).message };
  }
}

export async function rotateKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  if (!(await projectFor(db, ownerId, projectId))) return { key: null, projectId: null, error: "not your project" };
  const { key } = await rotateKey(db, projectId);
  revalidatePath(`/app/${projectId}/settings`);
  return { key, projectId, error: null };
}

export async function acknowledgeAction(form: FormData): Promise<void> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  const flagId = String(form.get("flagId") ?? "");
  if (!(await projectFor(db, ownerId, projectId))) return;
  await acknowledge(db, projectId, flagId);
  revalidatePath(`/app/${projectId}/flags/${flagId}`);
  revalidatePath(`/app/${projectId}`);
}

export async function setQuietAction(form: FormData): Promise<void> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  if (!(await projectFor(db, ownerId, projectId))) return;
  const hours = Number(form.get("hours") ?? 6);
  await setQuiet(db, projectId, Math.round(hours * 3_600_000));
  revalidatePath(`/app/${projectId}/settings`);
}
```

- [ ] **Step 5: Client pieces**

`components/app/CreateProject.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import { createProjectAction, type KeyState } from "@/app/app/actions";
import { configLines } from "@/lib/watch/config-lines";

const initial: KeyState = { key: null, projectId: null, error: null };

export default function CreateProject({ origin }: { origin: string }) {
  const [state, action, pending] = useActionState(createProjectAction, initial);
  if (state.key && state.projectId) {
    return (
      <div className="app-card app-key">
        <div className="eyebrow">Your project key, shown once</div>
        <p>Copy these three lines into the broker's environment. The key is not stored anywhere in plain text and cannot be shown again. Rotate it from settings if you lose it.</p>
        <pre className="mono">{configLines(state.key, "purse", origin)}</pre>
        <a className="btn primary" href={`/app/${state.projectId}`}>Open the project</a>
      </div>
    );
  }
  return (
    <form action={action} className="app-card app-form">
      <label>Name<input name="name" required maxLength={80} placeholder="reference broker" /></label>
      <label>Stream<input name="stream" defaultValue="purse" maxLength={80} /></label>
      {state.error ? <p className="app-error">{state.error}</p> : null}
      <button className="btn primary" disabled={pending} type="submit">{pending ? "Creating" : "Create project"}</button>
    </form>
  );
}
```

`components/app/RotateKey.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import { rotateKeyAction, type KeyState } from "@/app/app/actions";
import { configLines } from "@/lib/watch/config-lines";

const initial: KeyState = { key: null, projectId: null, error: null };

export default function RotateKey({ projectId, stream, origin }: { projectId: string; stream: string; origin: string }) {
  const [state, action, pending] = useActionState(rotateKeyAction, initial);
  return (
    <div>
      {state.key ? (
        <div className="app-key">
          <div className="eyebrow">New key, shown once. The old one is revoked.</div>
          <pre className="mono">{configLines(state.key, stream, origin)}</pre>
        </div>
      ) : null}
      {state.error ? <p className="app-error">{state.error}</p> : null}
      <form action={action}>
        <input type="hidden" name="projectId" value={projectId} />
        <button className="btn" disabled={pending} type="submit">{pending ? "Rotating" : "Rotate key"}</button>
      </form>
    </div>
  );
}
```

`components/app/Acknowledge.tsx`:

```tsx
import { acknowledgeAction } from "@/app/app/actions";

export default function Acknowledge({ projectId, flagId, acknowledgedAt }: { projectId: string; flagId: string; acknowledgedAt: Date | null }) {
  if (acknowledgedAt) return <p className="app-muted mono">acknowledged {acknowledgedAt.toISOString()}</p>;
  return (
    <form action={acknowledgeAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="flagId" value={flagId} />
      <button className="btn primary" type="submit">Acknowledge</button>
    </form>
  );
}
```

- [ ] **Step 6: Pages**

All four pages are server components, `export const dynamic = "force-dynamic";`, and start with:

```ts
const { userId } = await auth();
if (!userId) redirect("/app");
```

(`auth` from `@clerk/nextjs/server`, `redirect` from `next/navigation`). `ORIGIN` is `process.env.APP_ORIGIN ?? "https://www.deadlatch.dev"`.

`app/app/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { projectsFor } from "@/lib/watch/queries";
import CreateProject from "@/components/app/CreateProject";

export const metadata: Metadata = { title: "Projects — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";
const ORIGIN = process.env.APP_ORIGIN ?? "https://www.deadlatch.dev";

export default async function Projects() {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const list = await projectsFor(db, userId);
  return (
    <main className="wrap logwrap app">
      <header className="log-hd">
        <div className="eyebrow">Watch</div>
        <h1>Projects</h1>
        <p>A project is one receipt stream with one key. Point a monitor at it with three environment lines and its flags land here.</p>
      </header>
      {list.length > 0 ? (
        <div className="log-list">
          {list.map((p) => (
            <Link key={p.id} href={`/app/${p.id}`} className="log-item">
              <span className="log-date mono">{p.stream}</span>
              <span className="log-copy"><span className="log-title">{p.name}</span><span className="log-desc">created {p.createdAt.toISOString().slice(0, 10)}</span></span>
              <span className="log-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      ) : null}
      <h2 className="app-h2">{list.length > 0 ? "New project" : "Your first project"}</h2>
      <CreateProject origin={ORIGIN} />
    </main>
  );
}
```

`app/app/[project]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { dashboard, projectFor } from "@/lib/watch/queries";

export const metadata: Metadata = { title: "Project — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATE_LABEL = { never: "no heartbeat yet", ok: "monitor alive", amber: "heartbeat late", red: "heartbeat missing" } as const;

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const { project: id } = await params;
  const project = await projectFor(db, userId, id);
  if (!project) notFound();
  const d = await dashboard(db, project.id);
  const expectations = Array.from(new Set([...Object.keys(d.counts.week), ...Object.keys(d.counts.day)])).sort();
  return (
    <main className="wrap logwrap app">
      <Link href="/app" className="log-back mono">← Projects</Link>
      <header className="log-hd">
        <div className="eyebrow">{project.stream}</div>
        <h1>{project.name}</h1>
        <p className="mono app-links"><Link href={`/app/${project.id}/settings`}>settings</Link></p>
      </header>
      <section className="app-card app-status">
        <span className={`app-dot ${d.monitor.state}`} aria-hidden="true" />
        <div>
          <div className="app-status-label">{STATE_LABEL[d.monitor.state]}</div>
          <div className="mono app-muted">
            {d.monitor.version ? `monitor ${d.monitor.version}` : "no monitor has reported"}
            {d.monitor.cursorSeq !== null ? ` · cursor ${d.monitor.cursorSeq}` : ""}
            {d.monitor.lastHeartbeatAt ? ` · last heartbeat ${d.monitor.lastHeartbeatAt.toISOString()}` : ""}
          </div>
        </div>
      </section>
      <section className="app-card">
        <div className="eyebrow">Flags by expectation</div>
        {expectations.length === 0 ? <p className="app-muted">No flags yet. That is the good outcome, not an empty one.</p> : (
          <table className="app-table">
            <thead><tr><th>expectation</th><th>24 hours</th><th>7 days</th></tr></thead>
            <tbody>{expectations.map((e) => <tr key={e}><td className="mono">{e}</td><td className="mono">{d.counts.day[e] ?? 0}</td><td className="mono">{d.counts.week[e] ?? 0}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <section className="app-card">
        <div className="eyebrow">Recent flags</div>
        {d.recent.length === 0 ? <p className="app-muted">Nothing to show.</p> : (
          <table className="app-table">
            <thead><tr><th>expectation</th><th>payee</th><th>amount</th><th>seq</th><th>at</th></tr></thead>
            <tbody>
              {d.recent.map((f) => (
                <tr key={f.id} className={f.acknowledgedAt ? "app-ack" : ""}>
                  <td><Link href={`/app/${project.id}/flags/${f.id}`} className="mono">{f.expectationId}</Link></td>
                  <td className="mono">{f.payee ?? ""}</td>
                  <td className="mono">{f.amount ?? ""}</td>
                  <td className="mono">{f.ref.seq}</td>
                  <td className="mono">{f.at.toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

`app/app/[project]/flags/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { flagFor, projectFor } from "@/lib/watch/queries";
import Acknowledge from "@/components/app/Acknowledge";

export const metadata: Metadata = { title: "Flag — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FlagPage({ params }: { params: Promise<{ project: string; id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const { project: pid, id } = await params;
  const project = await projectFor(db, userId, pid);
  if (!project) notFound();
  const flag = await flagFor(db, project.id, id);
  if (!flag) notFound();
  const ref = flag.ref as { stream: string; seq: number; id: string; hash: string; ts: string };
  const offender = flag.offender as { action: string; outcome?: string; input?: unknown };
  const window = flag.window as { fromSeq: number; toSeq: number; count: number; matched: Array<{ seq: number; hash: string; ts: string }> };
  return (
    <main className="wrap logwrap app">
      <Link href={`/app/${project.id}`} className="log-back mono">← {project.name}</Link>
      <header className="log-hd">
        <div className="eyebrow">{flag.expectationId}</div>
        <h1>{flag.reason}</h1>
        <p className="mono app-muted">flag {flag.id.slice(0, 12)} · raised {flag.at.toISOString()} · received {flag.receivedAt.toISOString()}</p>
      </header>
      <section className="app-card">
        <div className="eyebrow">The offending record</div>
        <p className="mono">{offender.action}{offender.outcome ? ` → ${offender.outcome}` : ""}</p>
        <pre className="mono app-pre">{JSON.stringify(offender.input ?? flag.cause, null, 2)}</pre>
      </section>
      <section className="app-card">
        <div className="eyebrow">The receipt</div>
        <dl className="app-dl">
          <dt>stream</dt><dd className="mono">{ref.stream}</dd>
          <dt>seq</dt><dd className="mono">{ref.seq}</dd>
          <dt>id</dt><dd className="mono">{ref.id}</dd>
          <dt>hash</dt><dd className="mono app-hash">{ref.hash}</dd>
          <dt>ts</dt><dd className="mono">{ref.ts}</dd>
        </dl>
      </section>
      <section className="app-card">
        <div className="eyebrow">The window that tripped it</div>
        <p className="mono app-muted">seq {window.fromSeq} to {window.toSeq}, {window.count} records, {window.matched.length} matched this rule</p>
        {window.matched.length > 0 ? (
          <ul className="app-list mono">{window.matched.map((m) => <li key={m.seq}>seq {m.seq} · {m.hash.slice(0, 8)} · {m.ts}</li>)}</ul>
        ) : null}
      </section>
      <section className="app-card">
        <div className="eyebrow">Verify it yourself</div>
        <p>Export the chain from the broker's admin port and the anchors from its witness, then run the verifier with the two public keys. The flag points at seq {ref.seq}.</p>
        <pre className="mono app-pre">{`npx -p @olurabian/receipt receipt-verify chain.json --anchors anchors.json --log-key <origin>=<base64> --witness-key <base64> --stream ${ref.stream}`}</pre>
      </section>
      <Acknowledge projectId={project.id} flagId={flag.id} acknowledgedAt={flag.acknowledgedAt} />
    </main>
  );
}
```

`app/app/[project]/settings/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { keyInfo, projectFor } from "@/lib/watch/queries";
import { configLines } from "@/lib/watch/config-lines";
import { setQuietAction } from "@/app/app/actions";
import RotateKey from "@/components/app/RotateKey";

export const metadata: Metadata = { title: "Settings — Deadlatch", robots: { index: false } };
export const dynamic = "force-dynamic";
const ORIGIN = process.env.APP_ORIGIN ?? "https://www.deadlatch.dev";

export default async function SettingsPage({ params }: { params: Promise<{ project: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  const { project: id } = await params;
  const project = await projectFor(db, userId, id);
  if (!project) notFound();
  const key = await keyInfo(db, project.id);
  return (
    <main className="wrap logwrap app">
      <Link href={`/app/${project.id}`} className="log-back mono">← {project.name}</Link>
      <header className="log-hd">
        <div className="eyebrow">Settings</div>
        <h1>{project.name}</h1>
      </header>
      <section className="app-card">
        <div className="eyebrow">Project key</div>
        <p className="mono">{key ? `dl_live_${key.prefix}… made ${key.createdAt.toISOString().slice(0, 10)}` : "no live key"}</p>
        <p>The broker's monitor reads these three lines. The key itself was shown once when it was made; rotating makes a new one and revokes the old one, and a monitor still using the old key stops with a 403.</p>
        <pre className="mono app-pre">{configLines(null, project.stream, ORIGIN)}</pre>
        <RotateKey projectId={project.id} stream={project.stream} origin={ORIGIN} />
      </section>
      <section className="app-card">
        <div className="eyebrow">Alert</div>
        <p>One email on the first flag after a quiet period. Currently {Math.round(project.alertQuietMs / 3_600_000 * 10) / 10} hours.</p>
        <form action={setQuietAction} className="app-inline">
          <input type="hidden" name="projectId" value={project.id} />
          <label>Quiet period, hours <input name="hours" type="number" min={0.02} step={0.5} defaultValue={project.alertQuietMs / 3_600_000} /></label>
          <button className="btn" type="submit">Save</button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Styles**

Append to `app/globals.css`:

```css
/* app */
.app .app-h2 { font-size: 1.1rem; color: var(--ink); margin: 32px 0 12px; }
.app-card { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 18px 20px; margin: 0 0 16px; }
.app-card p { color: var(--muted); margin: 8px 0 0; line-height: 1.6; }
.app-form label { display: block; color: var(--muted); font-size: 0.9rem; margin: 0 0 12px; }
.app-form input, .app-inline input { display: block; width: 100%; max-width: 420px; margin-top: 6px; padding: 9px 11px; background: var(--panel2); border: 1px solid var(--line2); border-radius: 8px; color: var(--ink); font: inherit; }
.app-inline { display: flex; align-items: flex-end; gap: 12px; margin-top: 12px; }
.app-inline label { color: var(--muted); font-size: 0.9rem; }
.app-inline input { width: 120px; }
.app-error { color: var(--deny); }
.app-key pre, .app-pre { margin: 12px 0 0; padding: 12px 14px; background: var(--panel2); border: 1px solid var(--line); border-radius: 10px; font-size: 0.86rem; line-height: 1.55; overflow-x: auto; color: var(--ink); }
.app-key .btn { margin-top: 14px; }
.app-status { display: flex; align-items: center; gap: 14px; }
.app-status-label { color: var(--ink); font-weight: 600; }
.app-dot { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; background: var(--faint); }
.app-dot.ok { background: var(--allow); box-shadow: 0 0 0 4px var(--allow-bg); }
.app-dot.amber { background: var(--hold); box-shadow: 0 0 0 4px var(--hold-bg); }
.app-dot.red { background: var(--deny); box-shadow: 0 0 0 4px var(--deny-bg); }
.app-muted { color: var(--faint); font-size: 0.86rem; }
.app-links a { color: var(--allow); }
.app-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.92rem; display: block; overflow-x: auto; }
.app-table th, .app-table td { text-align: left; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.app-table th { color: var(--faint); font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; }
.app-table a { color: var(--allow); text-decoration: none; }
.app-table tr.app-ack td { color: var(--faint); }
.app-dl { display: grid; grid-template-columns: 80px 1fr; gap: 6px 12px; margin-top: 10px; }
.app-dl dt { color: var(--faint); font-family: var(--mono); font-size: 0.8rem; }
.app-dl dd { margin: 0; color: var(--ink); word-break: break-all; }
.app-hash { font-size: 0.8rem; }
.app-list { margin: 10px 0 0; padding-left: 18px; color: var(--muted); font-size: 0.86rem; line-height: 1.7; }
```

- [ ] **Step 8: Build, typecheck, commit**

Run: `npm run lint` clean, `npm run build` succeeds and lists `/app`, `/app/[project]`, `/app/[project]/flags/[id]`, `/app/[project]/settings` as dynamic routes. `npm test` all passing (26).

```bash
git add lib/watch/config-lines.ts lib/watch/queries.ts app/app components/app app/globals.css test/queries.test.ts
git commit -m "app: projects, dashboard, flag detail, settings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Bootstrap script and the onboarding doc

**Files:**
- Create: `scripts/bootstrap-project.ts`, `docs/watch.md`

- [ ] **Step 1: The bootstrap script**

`scripts/bootstrap-project.ts` creates a project for a Clerk user and hands the key to a command without printing it:

```ts
// Usage: npx tsx scripts/bootstrap-project.ts <clerk user id> "<name>" <stream> [-- <command that reads the key on stdin>]
// Prints only the project id and the key prefix. With a trailing command, pipes the plain key into that command's stdin.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { spawnSync } from "node:child_process";
import { db } from "../lib/db/client";
import { createProject } from "../lib/watch/queries";
import { keyPrefix } from "../lib/watch/keys";

async function main() {
  const [ownerId, name, stream = "purse", dashDash, ...cmd] = process.argv.slice(2);
  if (!ownerId || !name) { console.error("usage: bootstrap-project <clerk user id> <name> [stream] [-- command]"); process.exit(2); }
  const { project, key } = await createProject(db, ownerId, name, stream);
  console.log(`project ${project.id} key prefix ${keyPrefix(key)}`);
  if (dashDash === "--" && cmd.length > 0) {
    const r = spawnSync(cmd[0]!, cmd.slice(1), { input: key, stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" });
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

The release task uses it as `npx tsx scripts/bootstrap-project.ts <user> "reference broker" purse -- sh -c 'flyctl secrets set DEADLATCH_PROJECT_KEY="$(cat)" -a purse-broker'`, so the key travels from the database to Fly without touching a terminal history or the chat.

- [ ] **Step 2: The doc**

`docs/watch.md`, colon-free prose:

```markdown
# Watch

The hosted side of the Deadlatch monitor. Sign in at deadlatch.dev/app, create a project, copy the three lines it prints into the broker's environment, and the monitor's flags land on the project page within a minute of being raised.

What a project holds. One receipt stream, one live key, a monitor row that the heartbeat keeps fresh, the flags, and the alert log. Keys are stored as a hash and shown once. Rotating a key revokes the old one, and a monitor still using it stops with a 403 until its environment is updated.

What the API accepts. `POST /api/v1/flags` with a bearer key and a body of at most a hundred flags and one megabyte. Flags are keyed on their id, so a retried batch is counted as duplicates and stored once. `POST /api/v1/heartbeat` with the monitor's version, stream, interval, cursor and the time of its last accepted flag. Unknown keys get 401, revoked ones 403, oversize bodies 413, malformed ones 422 with the first failing index and field.

What the dashboard shows. A heartbeat dot that goes amber after two intervals and red after three, counts by expectation over a day and a week, the fifty newest flags, and for each flag the offending record, the receipt reference, the window that tripped it, and the verify command. Acknowledging a flag dims it and is the only thing a user can change about one.

The alert. One plain email per project per quiet period, six hours by default, on the first flag after silence, to the owner's sign-in address. The sender is Resend's onboarding address until deadlatch.dev is verified there, which is a DNS task for the owner.

Running the tests. `npm test` runs everything against an in-process Postgres with the real migrations, so no database or key is needed. `npm run db:migrate` applies the migrations to the database in `DATABASE_URL`.
```

- [ ] **Step 3: Sweep, commit**

```bash
grep -nE "^[^\`#|].*(:|—)" docs/watch.md | grep -v "https\?://"
git add scripts/bootstrap-project.ts docs/watch.md
git commit -m "app: bootstrap script and the watch doc

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Gate, deploy, connect (runs only on ARABA's go)

- [ ] **Step 1: Migrate the Neon database and smoke the routes locally**

```bash
npm run db:migrate
npm run build
npx next start -p 3123 &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3123/app                      # 3xx to Clerk's sign-in
curl -s -X POST -o /dev/null -w "%{http_code}\n" http://localhost:3123/api/v1/flags      # 401
node -e 'fetch("http://localhost:3123/api/v1/heartbeat",{method:"POST",headers:{authorization:"Bearer dl_live_nope"},body:"{}"}).then(r=>console.log(r.status))'   # 401
node scripts/crawl.mjs http://localhost:3123 > crawl-after.txt; diff crawl-before.txt crawl-after.txt && echo "public site unchanged"
kill %1
```

- [ ] **Step 2: Release through the protected flow and deploy**

```bash
git push origin HEAD:release/watch-app
# wait for gitleaks (secrets) on the pushed commit
gh api repos/ArabianAnalyst/deadlatch/commits/$(git rev-parse HEAD)/check-runs --jq '[.check_runs[] | {name, conclusion}]'
git push origin HEAD:main
git push origin --delete release/watch-app
npx vercel deploy --prod --yes
node scripts/crawl.mjs https://www.deadlatch.dev
```

Confirm the Vercel project's environment carries `APP_ORIGIN=https://www.deadlatch.dev` (add it with `vercel env add` if the integrations did not) and that the production deployment's env includes the Neon, Clerk and Resend variables.

- [ ] **Step 3: ARABA signs in once, then the bootstrap**

ARABA opens https://www.deadlatch.dev/app and signs in (Clerk's hosted page). Then, from the repository root with `.env.local` pulled:

```bash
node -e 'const { createClerkClient } = require("@clerk/backend"); createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUserList({ limit: 5 }).then(r => r.data.forEach(u => console.log(u.id, u.emailAddresses[0]?.emailAddress)))'
npx tsx scripts/bootstrap-project.ts <user id> "reference broker" purse -- sh -c 'flyctl secrets set DEADLATCH_PROJECT_KEY="$(cat)" -a purse-broker'
```

Fly restarts the machines. Then on the monitor machine `GET /` shows `sink deadlatch` and the key prefix, and within one interval the project page shows a green dot and cursor 6.

- [ ] **Step 4: A real flag**

Trip the velocity rule on the reference broker through its agent port, five spends of `$12.50` to `api.stripe.com` inside ten minutes (the README's walkthrough), then confirm the flag on the project page with full detail, and the alert email in ARABA's inbox.

- [ ] **Step 5: Record**

Ledger the project id, the key prefix, the flag id, and the email's arrival. DoD items 3 and 5 done. Item 4, the non-author run, is a handover to the design-partner counterpart, role words only.
