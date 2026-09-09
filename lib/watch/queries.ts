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

export async function rotateKey(db: Db, ownerId: string, projectId: string): Promise<{ key: string; prefix: string }> {
  if (!(await projectFor(db, ownerId, projectId))) throw new Error("not your project");
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

export async function setQuiet(db: Db, ownerId: string, projectId: string, ms: number): Promise<void> {
  if (!Number.isInteger(ms) || ms < 60_000) throw new Error("the quiet period must be at least one minute");
  if (ms > 30 * 24 * 3_600_000) throw new Error("the quiet period must be at most thirty days");
  if (!(await projectFor(db, ownerId, projectId))) throw new Error("not your project");
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
  monitor: { state: MonitorState; version: string | null; cursorSeq: number | null; lastHeartbeatAt: Date | null; intervalMs: number | null; lastAlertAt: Date | null; lastAlertError: string | null };
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
  const recent = (await db.select().from(flags).where(eq(flags.projectId, projectId)).orderBy(desc(flags.receivedAt), desc(sql`(${flags.ref}->>'seq')::bigint`)).limit(50)).map(row);
  return { monitor: { state, version: m?.version ?? null, cursorSeq: m?.cursorSeq ?? null, lastHeartbeatAt: m?.lastHeartbeatAt ?? null, intervalMs: m?.intervalMs ?? null, lastAlertAt: m?.lastAlertAt ?? null, lastAlertError: m?.lastAlertError ?? null }, counts: { day, week }, recent };
}

export async function flagFor(db: Db, projectId: string, flagId: string): Promise<FlagRecord | null> {
  const [f] = await db.select().from(flags).where(and(eq(flags.projectId, projectId), eq(flags.id, flagId)));
  return f ?? null;
}

/** Sets acknowledgedAt once for the owner's own flag; a second call keeps the first time, a stranger's call does nothing. */
export async function acknowledge(db: Db, ownerId: string, projectId: string, flagId: string, now: Date = new Date()): Promise<void> {
  if (!(await projectFor(db, ownerId, projectId))) return;
  await db.update(flags).set({ acknowledgedAt: now }).where(and(eq(flags.projectId, projectId), eq(flags.id, flagId), isNull(flags.acknowledgedAt)));
}
