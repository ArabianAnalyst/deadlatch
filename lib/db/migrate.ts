import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
}

main().catch((e) => { console.error(e); process.exit(1); });
