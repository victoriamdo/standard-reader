/**
 * Entrypoint: wire the three pieces together.
 *
 *   Jetstream ──▶ detector ──▶ sign ──▶ SQLite ──▶ queryLabels / subscribeLabels
 *
 * The store is the seam: the ingest loop writes signed labels, the server reads
 * them. Either side can run alone (e.g. serve-only with an empty store).
 */

import { config } from "./config.ts";
import { openDb } from "./db.ts";
import { preload } from "./detector.ts";
import { startIngest } from "./ingest.ts";
import { startServer } from "./server.ts";
import { loadKeypair } from "./sign.ts";

async function main(): Promise<void> {
  if (!config.signingKeyHex) {
    throw new Error(
      "LABELER_SIGNING_KEY is required (run `pnpm gen-key` to make one).",
    );
  }

  const db = openDb(config.sqlitePath);
  const keypair = await loadKeypair(config.signingKeyHex);

  console.log(`[claudeslop] waiting for detector at ${config.detectorUrl}…`);
  await preload();
  console.log("[claudeslop] detector ready");

  startServer(db, keypair);
  startIngest(db, keypair);
}

main().catch((error) => {
  console.error("[claudeslop] fatal", error);
  process.exit(1);
});
