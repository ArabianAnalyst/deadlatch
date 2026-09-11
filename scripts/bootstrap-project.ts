// Usage: npx tsx scripts/bootstrap-project.ts <clerk user id> "<name>" <stream> [--fly <app>] [-- <command that reads the key on stdin>]
// Prints only the project id and the key prefix. With a trailing command, pipes the plain key into that command's stdin.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { db } from "../lib/db/client";
import { createProject } from "../lib/watch/queries";
import { keyPrefix } from "../lib/watch/keys";

async function main() {
  const argv = process.argv.slice(2);
  const flyAt = argv.indexOf("--fly");
  const flyApp = flyAt >= 0 ? argv[flyAt + 1] : undefined;
  const rest = flyAt >= 0 ? argv.filter((_, i) => i !== flyAt && i !== flyAt + 1) : argv;
  const [ownerId, name, stream = "purse", dashDash, ...cmd] = rest;
  if (!ownerId || !name || (flyAt >= 0 && !flyApp)) { console.error("usage: bootstrap-project <clerk user id> <name> [stream] [--fly <fly app>] [-- command]"); process.exit(2); }
  const flyctl = process.env.FLYCTL ?? (spawnSync("flyctl", ["version"], { stdio: "ignore", shell: process.platform === "win32" }).status === 0 ? "flyctl" : join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".fly", "bin", process.platform === "win32" ? "flyctl.exe" : "flyctl"));
  if (flyApp && spawnSync(flyctl, ["version"], { stdio: "ignore", shell: process.platform === "win32" }).status !== 0) { console.error(`flyctl not found (tried ${flyctl}); set FLYCTL to its path`); process.exit(2); }
  const { project, key } = await createProject(db, ownerId, name, stream);
  console.log(`project ${project.id} key prefix ${keyPrefix(key)}`);
  if (flyApp) {
    const r = spawnSync(flyctl, ["secrets", "set", `DEADLATCH_PROJECT_KEY=${key}`, "-a", flyApp], { stdio: ["ignore", "inherit", "inherit"], shell: process.platform === "win32" });
    process.exit(r.status ?? 1);
  }
  if (dashDash === "--" && cmd.length > 0) {
    const r = spawnSync(cmd[0]!, cmd.slice(1), { input: key, stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" });
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
