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
