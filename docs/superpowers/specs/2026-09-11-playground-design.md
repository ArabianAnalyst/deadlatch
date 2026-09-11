# The playground, deadlatch.dev/try

Design approved in outline 2026-09-11, with one amendment taken the same day (the witness serves the chain).

## Goal

The slowest part of the stack is the gap between "shipped" and "someone ran it". A stranger's run of the broker costs an afternoon and a volunteer. The playground makes it thirty seconds and nobody. A visitor opens deadlatch.dev/try, presses a button, and a real broker decides against a real policy, pays through the mock rail, writes a hash-chained receipt the visitor can see with its hash, under a chain head a witness has anchored in a public transparency log. Five presses trip the watch and a flag appears on the same page. Every button shows the curl that does the same thing without the page.

## Decisions taken

1. A dedicated playground broker, a second Fly app from the same image with its own stream, witness, monitor and dashboard project. The reference chain that the log posts and the sceptic run point at stays what it is.
2. Guided presets, five buttons, each a real call with a fixed body. No free-form amounts, so the page cannot be used as a relay.
3. Calls go through deadlatch.dev route handlers, which hold the rate limit and hide nothing, the curl is beside every result.
4. The witness gains a read-only `GET /chain` route so the visitor's own receipt, and the sceptic's verify command, have a public read path. That is purse-broker 0.3.2 and it ships first.

## Scope, two parts

| Part | Repository | Deliverable |
|---|---|---|
| 1 | purse (`deploy/broker`) | Witness route `GET /chain`, `fly.playground.toml`, README section, CHANGELOG, image 0.3.2 |
| 2 | deadlatch | `/try` page, `/api/try/*` handlers, limiter migration, public flags read, provisioning and release on ARABA's go |

Part 1 releases before Part 2 is provisioned, because the playground app runs image 0.3.2.

---

## Part 1, purse-broker 0.3.2, the witness serves the chain

### The route

`GET /chain?since=<seq>&limit=<n>&format=<json|jsonl>` on the witness port.

- `since` is the 0-based position in the stream, the same number the anchors call `seq`. Default 0. A non-integer or negative value answers 400 `{ error: "since must be a non-negative integer seq" }`.
- `limit` defaults to 100 and is capped at 500. Values above the cap are clamped, not rejected. Zero or negative answers 400.
- `format=json` (default) answers `{ stream, total, head, since, count, records }` where `records` are the stored envelopes verbatim, `{ id, ts, kind, payload, prevHash, hash }`, oldest first, and `head` is `{ seq, hash }` of the current last record or `null` on an empty stream. `total` is the stream length so a client can ask for a tail with `since = total - n`.
- `format=jsonl` answers `application/x-ndjson`, one envelope per line, the same slice, no wrapper. This is the shape `npx receipt-verify` reads from a file, so `curl -s "<witness>/chain?format=jsonl&limit=500" > chain.jsonl` feeds the sceptic command directly.
- The records come from the same `records()` load the verify tick uses, sliced. No second reader, no new query.
- Read-only, no token, like the rest of the witness port. No CORS headers, the page proxies server-side.

The index route lists `GET /chain` beside the others, and `verifyWith` names `<this url>/chain?format=jsonl` as where the chain file comes from.

### Playground configuration in the repository

`deploy/broker/fly.playground.toml`, committed, is the reference broker's `fly.toml` with these differences.

- `app = "purse-playground"`.
- `PURSE_STREAM`, `WITNESS_STREAM` and `MONITOR_STREAM` are `playground`.
- Policy, `PURSE_MAX_PER_ACTION` `$50`, `PURSE_MAX_PER_DAY` `$5000`, `PURSE_REQUIRE_APPROVAL_OVER` `$20`, `PURSE_ALLOW` `api.stripe.com`. The daily cap is a hard stop against abuse that the page cannot lift.
- `MONITOR_INTERVAL_MS` `15000`, so a flag lands while the visitor is still on the page. Witness interval stays at the default five minutes.
- A second `[[services]]` block for the `witness` process, `internal_port = 8082`, external port `8082` with `tls` and `http` handlers, and a `/healthz` check. The agent port stays on 443 and 80. Admin and monitor ports stay private.

The README's deploy guide gains a section, "A playground broker", that walks the provisioning below and states the two safety lines, mock executor, and the daily cap.

### Version, docs, tests, release

Version 0.3.2. CHANGELOG entry under 0.3.2, the route and the playground config. README "The witness" documents the route with one example each for json and jsonl. Tests in the witness server suite, since and limit validation, oldest-first order, the 500 cap, `total` and `head`, the jsonl content type and line count, an empty stream. Release through the protected flow, tag `broker-v0.3.2`, image `ghcr.io/arabiananalyst/purse-broker:0.3.2`, then the reference deployment moves to 0.3.2 (its witness port stays private, nothing else changes there).

---

## Part 2, the playground app and deadlatch.dev/try

### Provisioning, on ARABA's go

- Fly app `purse-playground`, region `lhr`, image 0.3.2, `fly.playground.toml`.
- Database `purse_playground` created in the existing `purse-broker-db` cluster. `DATABASE_URL` is the cluster's connection string with that database name. Secrets `PURSE_ADMIN_TOKEN` (new, never reused from the reference), `WITNESS_KEY_PEM` (new, from `node dist/witness.js keygen`), `REKOR_LOG_KEY` (the same public log key), `DEADLATCH_PROJECT_KEY` (below). No OTel on the playground.
- A dashboard project named `playground`, stream `playground`, under ARABA's account, created with the bootstrap script. On Windows the key goes to flyctl directly, not through a shell hand-off.
- deadlatch environment, `TRY_BROKER_URL=https://purse-playground.fly.dev`, `TRY_WITNESS_URL=https://purse-playground.fly.dev:8082`, `TRY_PROJECT_ID=<the project's uuid>`. Server-only, never `NEXT_PUBLIC_`.

### The page

`/try`, a server component that renders the frame and a client island `Playground`. It sits outside the Clerk matcher (`/app(.*)`), so no sign-in. Three panels, Enforce, Prove, Watch, three columns from 1100px and stacked below, in the site's console language, `--allow`, `--hold`, `--deny` tokens, the existing `.console` and `.btn` styles.

Honesty strip, first thing on the page. "A playground broker. Mock rail, nothing settles. Same image as the reference deployment, its own chain. Every button is a real call, and the curl that does the same thing sits beside the result."

**Enforce.** Five buttons. Each result is a card with the decision chip (allowed green, held amber, denied red), the broker's `reason` verbatim, `explain.rule`, `explain.policyVersion`, and a disclosure with the exact curl against the public broker URL.

| Button | Body sent by the server | Expected decision |
|---|---|---|
| Pay $12.50 | `{ amount: "$12.50", payee: "api.stripe.com", intent: "playground" }` | allowed, then executed, `status: "paid"` |
| Pay $35.00 | `{ amount: "$35.00", payee: "api.stripe.com", intent: "playground" }` | needs_approval, a `pendingId` |
| Pay $75.00 | `{ amount: "$75.00", payee: "api.stripe.com", intent: "playground" }` | denied, `per-action-cap` |
| Pay a payee off the list | `{ amount: "$12.50", payee: "evil.example", intent: "playground" }` | denied, `allowlist-miss` |
| Five in a row | five of the first body, one second apart | five paid, then a flag |

An allowed decision is executed at once by the page, and the card shows both halves, the decision and `{ status, reason, receipt: { ok, ref, paidAmount } }`. A held decision shows the `pendingId` and the line "Held for a human. Nobody is here, so this one expires in fifteen minutes." The page polls `status` every five seconds for one minute and shows the state. When the daily cap is reached the visitor sees the broker's own denial with `daily-cap` as the rule, and one line under it, "The playground spent its day. The cap rolls over twenty-four hours, and that is the product working."

**Prove.** After any spend the panel fetches the chain tail and the anchor state.

- The chain tail, the newest 25 envelopes, newest first, each a card with position, `id`, `ts`, `kind`, `payload.status`, `payload.event`, `payload.reason`, a short `prevHash` and `hash`, and a disclosure with the full JSON. Records whose `payload.grantId` equals a grant the visitor holds are marked "yours". Denied decisions have no grant and sit unmarked at the top.
- Head and anchor. "Head at seq 231, hash 40e7…. Last anchored at seq 226, entry 101844748 in log2025-1.rekor.sigstore.dev, four minutes ago." Then the witness's live verify, "verifyAnchored ok, covered up to seq 226", and when the visitor's receipt is past the covered seq, "Your receipt is 5 past the last anchor. The witness anchors every five minutes." Red text when verify reports `ok: false`, with its reason.
- The sceptic block, copyable.

```
curl -s "https://purse-playground.fly.dev:8082/chain?format=jsonl&limit=500" > chain.jsonl
npx receipt-verify chain.jsonl --anchors https://purse-playground.fly.dev:8082 --log-key <from the witness index> --witness-key <from the witness index> --stream playground
```

The two keys are filled in from the witness index at render time, so the command is complete as shown.

**Watch.** The playground project's monitor state (the green, amber or red dot the dashboard uses) and its newest ten flags, each a card with `expectationId`, `reason`, the offender's receipt position, the window count, and `at`. On load the panel fetches once. After "Five in a row" it polls every five seconds for ninety seconds and stops when a flag newer than the press appears, then says "Flagged 23 seconds after the fifth spend." One line of CTA at the bottom, "Point your own broker at this. Three lines of config." linking to `/app`.

Failure states. Broker unreachable, the Enforce panel shows "The playground broker is not answering" with a link to its `/healthz`. Witness unreachable, the Prove panel shows the tail it last had and "The witness is not answering". Rate limited, the card says "Thirty spends per ten minutes per visitor. Try again in 4 minutes." Nothing on the page ever throws to a blank screen.

### The server side

Route handlers under `/api/try/`, outside the Clerk matcher, server-only environment.

| Route | Does | Limit |
|---|---|---|
| `POST /api/try/request` `{ preset }` | Maps the preset name to its fixed body, forwards to `${TRY_BROKER_URL}/request`, returns the broker JSON verbatim plus `curl` | counted |
| `POST /api/try/execute` `{ grantId }` | Forwards to `/execute` | counted |
| `POST /api/try/status` `{ pendingId }` | Forwards to `/status` | 60 per ten minutes, separate bucket |
| `GET /api/try/chain` | `${TRY_WITNESS_URL}/chain?since=max(0,total-25)&limit=25`, after reading `total` from the index, cached 5 seconds | none |
| `GET /api/try/anchor` | Witness index, last anchor, `/verify`, cached 15 seconds | none |
| `GET /api/try/flags` | Monitor state and newest ten flags for `TRY_PROJECT_ID`, read from the app database, cached 3 seconds | none |

- Presets are the only bodies the server will send. An unknown preset is 400. `grantId` and `pendingId` must match `^[A-Za-z0-9_-]{8,64}$`.
- The rate limit is per visitor, keyed by the sha256 of the client IP (`x-real-ip`, else the first `x-forwarded-for` hop). Thirty counted calls per rolling ten minutes. Stored in a table `try_limits (key text primary key, window_start timestamptz not null, count integer not null)`, migration 0003, one upsert per counted call. Over the limit answers 429 `{ error, retryAfterSec }`. Vercel instances do not share memory, which is why the table exists.
- Upstream timeout ten seconds. Upstream down answers 502 `{ error: "playground broker unreachable" }` or `"witness unreachable"`. Upstream 4xx is passed through with its body.
- The flags read is a new query, `publicWatch(db, projectId)`, that takes no owner and is used only by this route with `TRY_PROJECT_ID`. Every owner-scoped query stays as it is.
- Nothing on the page or in the handlers touches the admin port, and no secret reaches the client.

### Copy rules

No colons and no em dashes in any prose the visitor sees. No counterparty names. The first line says mock rail. Numbers on the page are the broker's numbers, never typed by hand.

### Tests

Part 1, the witness server suite covers the route as listed above.

Part 2, in the deadlatch repository.

- `lib/try/presets.ts`, pure, the preset map and the curl builder, tested for every preset and for the curl text.
- `lib/try/limiter.ts` against PGlite, thirty calls pass, the thirty-first is 429 with a retry time, a new window resets, two keys do not share a bucket.
- `lib/try/public.ts` against PGlite, `publicWatch` returns the monitor state and the newest ten flags for one project and nothing from another.
- Route handlers with an injected `fetch` standing in for the broker and the witness, every route, the error mapping, the pass-through of upstream 4xx, the preset guard, the id guard.
- After deploy, a Playwright flow on the live page. Press Pay $12.50, a card with a hash appears. Press Five in a row, a flag appears within ninety seconds. The stranger timer, page load to the first receipt hash on screen, under thirty seconds, recorded in the ledger.

### Release

Part 1 first, purse branch `witness-chain`, protected flow, tag, image, reference deploy. Then on ARABA's go, the provisioning above, deadlatch branch `try-page` through the protected flow to main, `vercel deploy --prod`, the three environment variables, the live Playwright flow, four screenshots, a Stack entry, and a new roadmap row in Phase 1, "1.8 the playground", marked done with the stranger time.

### Definition of done

1. A stranger with a browser sees a real chained receipt with its hash in under thirty seconds, no sign-up, no install.
2. Five presses produce a flag on the page within ninety seconds.
3. The sceptic command as shown on the page passes on a clean machine against the playground witness.
4. The page cannot relay an arbitrary spend, presets only, thirty per ten minutes per visitor, and the broker's daily cap behind that.

## Non-goals

- No approve or deny action for held spends. The page says why they expire.
- No reset. The chain is append-only, the caps and windows are the only reset.
- No per-visitor chains or sessions. Everyone shares the playground stream, and the page says so.
- No CORS on the broker or the witness, the page proxies.
- No OTel or Grafana on the playground.
- No change to the reference deployment beyond the image bump. Its witness and monitor ports stay private.
- No design change to the homepage console. The playground reuses its tokens and classes.
