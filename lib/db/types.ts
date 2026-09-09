import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any Drizzle Postgres database over our schema, the Neon one in production and the PGlite one in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
