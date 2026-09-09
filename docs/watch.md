# Watch

The hosted side of the Deadlatch monitor. Sign in at deadlatch.dev/app, create a project, copy the three lines it prints into the broker's environment, and the monitor's flags land on the project page within a minute of being raised.

The broker side is `ghcr.io/arabiananalyst/purse-broker`, version 0.3.1 or later, whose deploy guide lives at https://github.com/ArabianAnalyst/purse/tree/main/deploy/broker. Its monitor process reads the three lines above from its environment. A monitor attached to a chain that already exists starts at the head and judges only what arrives after it, so an existing chain of bad receipts does not appear here unless the monitor runs with `MONITOR_START=beginning`. The project page does not refresh on its own, reload it after the monitor's next tick.

What a project holds. One receipt stream, one live key, a monitor row that the heartbeat keeps fresh, the flags, and the alert log. Keys are stored as a hash and shown once. Rotating a key revokes the old one, and a monitor still using it stops with a 403 until its environment is updated.

What the API accepts. `POST /api/v1/flags` with a bearer key and a body of at most a hundred flags and four megabytes. Flags are keyed on their id, so a retried batch is counted as duplicates and stored once. `POST /api/v1/heartbeat` with the monitor's version, stream, interval, cursor and the time of its last accepted flag. Unknown keys get 401, revoked ones 403, oversize bodies 413, malformed ones 422 with the first failing index and field. A 413 or a 422 is discarded by the monitor with an event, never retried, so a malformed flag cannot wedge it.

What the dashboard shows. A heartbeat dot that goes amber after two intervals and red after three, counts by expectation over a day and a week, the fifty newest flags, and for each flag the offending record, the receipt reference, the window that tripped it, and the verify command. Acknowledging a flag dims it and is the only thing a user can change about one.

The alert. One plain email per project per quiet period, six hours by default, on the first flag after silence, to the owner's sign-in address. The sender is Resend's onboarding address until deadlatch.dev is verified there, which is a DNS task for the owner.

Running the tests. `npm test` runs everything against an in-process Postgres with the real migrations, so no database or key is needed. `npm run db:migrate` applies the migrations to the database in `DATABASE_URL`. Running the app needs `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `RESEND_API_KEY`, with `ALERT_FROM` and `APP_ORIGIN` optional, all pulled from Vercel with `vercel env pull .env.local`.
