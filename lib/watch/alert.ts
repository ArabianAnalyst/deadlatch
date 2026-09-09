import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
 * One email per project per quiet period, on the first new flag after silence. The window bucket's unique index
 * is what makes a double send impossible under concurrent batches, and the sliding check stops boundary doubles.
 * A failed send removes the row so the next flag retries.
 */
export async function maybeAlert(db: Db, mailer: Mailer, ownerEmail: OwnerEmail, projectId: string, flagIds: string[], now: Date = new Date(), origin = "https://www.deadlatch.dev"): Promise<{ sent: boolean; flagId?: string; error?: string }> {
  if (flagIds.length === 0) return { sent: false };
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return { sent: false };
  const to = await ownerEmail(project.ownerId);
  if (!to) {
    const error = "owner email not found";
    console.error("deadlatch alert failed", { projectId, error });
    return { sent: false, error };
  }
  const [last] = await db.select({ sentAt: alerts.sentAt }).from(alerts).where(eq(alerts.projectId, projectId)).orderBy(desc(alerts.sentAt)).limit(1);
  if (last && now.getTime() - last.sentAt.getTime() < project.alertQuietMs) return { sent: false };
  const alreadySent = new Set((await db.select({ flagId: alerts.flagId }).from(alerts).where(and(eq(alerts.projectId, projectId), inArray(alerts.flagId, flagIds)))).map((r) => r.flagId));
  const candidates = await db.select().from(flags).where(and(eq(flags.projectId, projectId), inArray(flags.id, flagIds.filter((id) => !alreadySent.has(id))))).orderBy(flags.at, sql`(${flags.ref}->>'seq')::bigint`);
  const flag = candidates[0];
  if (!flag) return { sent: false };
  const bucket = Math.floor(now.getTime() / project.alertQuietMs);
  const claimed = await db.insert(alerts).values({ projectId, flagId: flag.id, bucket, sentAt: now }).onConflictDoNothing().returning({ flagId: alerts.flagId });
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
  const clean = (s: string) => s.replace(/[\r\n\t]+/g, " ").slice(0, 120);
  try {
    await mailer.send({ to, subject: `Deadlatch, ${clean(flag.expectationId)} on ${clean(project.name)}`, text });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("deadlatch alert failed", { projectId, flagId: flag.id, error });
    await db.delete(alerts).where(and(eq(alerts.projectId, projectId), eq(alerts.flagId, flag.id)));
    return { sent: false, error };
  }
  return { sent: true, flagId: flag.id };
}
