/**
 * One-off / cron-safe backfill for publication `icon_url` and document
 * `cover_image_url`. Resolves each owning DID's PDS and builds the
 * `com.atproto.sync.getBlob` URL from the already-stored blob CID.
 *
 * Run with the same loader the ingest service uses:
 *   pnpm backfill:blobs
 */
import { backfillBlobUrls } from "../src/server/ingest/recompute.ts";

const result = await backfillBlobUrls();
// eslint-disable-next-line no-console
console.log(
  `Backfilled ${result.icons} publication icons and ${result.covers} document covers.`,
);
// The pg pool keeps the event loop alive; exit explicitly once we're done.
// eslint-disable-next-line unicorn/no-process-exit
process.exit(0);
