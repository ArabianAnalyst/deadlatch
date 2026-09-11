import type { Db } from "@/lib/db/types";
import { dashboard, type Dashboard, type FlagRow } from "@/lib/watch/queries";

/**
 * The playground project's watch panel, no owner check, used only by the /api/try/flags route with the
 * designated TRY_PROJECT_ID. Every owner-scoped query in lib/watch stays as it is.
 */
export async function publicWatch(db: Db, projectId: string, now: Date = new Date()): Promise<{ monitor: Dashboard["monitor"]; flags: FlagRow[] }> {
  const d = await dashboard(db, projectId, now);
  return { monitor: d.monitor, flags: d.recent.slice(0, 10) };
}
