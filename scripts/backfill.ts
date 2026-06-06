/**
 * One-shot backfill runner. Pulls real standard.site records from the network
 * into the configured DATABASE_URL via the ingestion consumer pipeline.
 *
 *   pnpm ingest:backfill                       # discover + backfill (defaults)
 *   pnpm ingest:backfill --max-repos=20
 *   pnpm ingest:backfill --dids=did:plc:aaa,did:plc:bbb
 *
 * Env is loaded via `node --env-file=.env` (see package.json script).
 */
import { backfill } from "../src/server/ingest/backfill.ts";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const maxReposArg = arg("max-repos");
const maxRecordsArg = arg("max-records");
const didsArg = arg("dids");

const result = await backfill({
  maxRepos: maxReposArg ? Number(maxReposArg) : undefined,
  maxRecordsPerCollection: maxRecordsArg ? Number(maxRecordsArg) : undefined,
  dids: didsArg ? didsArg.split(",").map((d) => d.trim()) : undefined,
  log: (message) => console.log(`[backfill] ${message}`),
});

console.log("[backfill] done:", result);
