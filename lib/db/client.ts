import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type NeonDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: NeonDb | null = null;
function getDb(): NeonDb {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Lazy, so importing this module never opens a connection and pages that do not touch the database build without one.
export const db = new Proxy({} as NeonDb, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
