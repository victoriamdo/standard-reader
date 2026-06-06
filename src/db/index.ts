import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

/**
 * The read-model runs on Neon in dev/prod but a plain local Postgres for
 * testing. The `@neondatabase/serverless` HTTP driver only speaks to Neon-style
 * endpoints, so we pick the driver from the connection string (override with
 * `DB_DRIVER=neon|pg`). Both expose the same Drizzle query API.
 */
function isNeonConnection(connectionString: string): boolean {
  const override = process.env.DB_DRIVER;
  if (override === "neon") {
    return true;
  }
  if (override === "pg") {
    return false;
  }
  return /neon\.tech|supabase\.co|vercel-storage\.com/i.test(connectionString);
}

// Pin a single concrete type so downstream code has one stable `db` type. The
// two drivers share the same query-builder API at runtime; the Neon branch is
// cast to match (execute() results differ only in wrapper, both expose `rows`).
export const db: NodePgDatabase<typeof schema> = isNeonConnection(url)
  ? (drizzleHttp({ client: neon(url), schema }) as unknown as NodePgDatabase<
      typeof schema
    >)
  : drizzleNode({ client: new Pool({ connectionString: url }), schema });
