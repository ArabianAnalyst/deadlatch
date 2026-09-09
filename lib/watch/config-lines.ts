/** The three lines a broker operator pastes. The key is only ever present right after it was made. */
export function configLines(key: string | null, stream: string, origin: string): string {
  return [`DEADLATCH_URL=${origin}`, `DEADLATCH_PROJECT_KEY=${key ?? "<shown once when the key was made>"}`, `MONITOR_STREAM=${stream}`].join("\n");
}
