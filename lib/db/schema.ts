import { bigint, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    /** floor(sentAt / the project's quiet period at claim time), so two claims inside one window collide whatever their flags. */
    bucket: bigint("bucket", { mode: "number" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.flagId] }), uniqueIndex("alerts_project_bucket").on(t.projectId, t.bucket), index("alerts_project_sent").on(t.projectId, t.sentAt)],
);
