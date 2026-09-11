import type { Db } from "@/lib/db/types";
import { dashboard, type FlagRow, type MonitorState } from "@/lib/watch/queries";

/**
 * The playground project's watch panel, no owner check, used only by the /api/try/flags route with the
 * designated TRY_PROJECT_ID. Every owner-scoped query in lib/watch stays as it is. Returns only the fields
 * the page uses, never the full monitor row: lastAlertError can carry the owner's mailbox.
 */
export async function publicWatch(db: Db, projectId: string, now: Date = new Date()): Promise<{ monitor: { state: MonitorState; cursorSeq: number | null }; flags: FlagRow[] }> {
  const d = await dashboard(db, projectId, now);
  return { monitor: { state: d.monitor.state, cursorSeq: d.monitor.cursorSeq }, flags: d.recent.slice(0, 10) };
}
