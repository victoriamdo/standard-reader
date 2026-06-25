/**
 * One-off backfill: label recent `site.standard.document` posts whose authors
 * have self-declared as bots, instead of waiting for them on Jetstream.
 *
 *   pnpm backfill            # last 100 (default)
 *   BACKFILL_LIMIT=50 pnpm backfill
 *
 * Lists recent documents from a public AppView and checks each author's profile
 * self-labels (cached) — no shared DB.
 */

import { isDeclaredBot } from "../src/bot.ts";
import { config } from "../src/config.ts";
import { getScanState, insertLabel, openDb, setScanState } from "../src/db.ts";
import { loadKeypair, signLabel } from "../src/sign.ts";

const APPVIEW = (
  process.env.APPVIEW_URL ?? "https://standard-reader.app"
).replace(/\/$/, "");
const LIMIT = Number(process.env.BACKFILL_LIMIT ?? 100);

interface FeedItem {
  uri: string;
  did: string;
}

async function recentDocuments(n: number): Promise<Array<FeedItem>> {
  const out: Array<FeedItem> = [];
  let cursor: string | undefined;
  while (out.length < n) {
    const url = new URL(`${APPVIEW}/xrpc/app.standard-reader.getLatestFeed`);
    url.searchParams.set("filter", "all");
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("cursor", cursor);
    let page: { cursor?: string; items?: Array<FeedItem> } | null = null;
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        page = (await res.json()) as {
          cursor?: string;
          items?: Array<FeedItem>;
        };
      }
    } catch {
      page = null;
    }
    const items = page?.items ?? [];
    if (items.length === 0) break;
    for (const it of items) {
      out.push(it);
      if (out.length >= n) break;
    }
    cursor = page?.cursor;
    if (!cursor) break;
  }
  return out;
}

async function main(): Promise<void> {
  if (!config.signingKeyHex) {
    throw new Error("LABELER_SIGNING_KEY is required (run `pnpm gen-key`).");
  }
  const db = openDb(config.sqlitePath);
  const keypair = await loadKeypair(config.signingKeyHex);

  console.log(`[backfill] listing ${LIMIT} recent documents from ${APPVIEW}…`);
  const docs = await recentDocuments(LIMIT);
  console.log(`[backfill] got ${docs.length}; checking authors…`);

  // De-dupe author lookups; many docs share an author.
  const botByDid = new Map<string, boolean>();
  let labeled = 0;

  for (const doc of docs) {
    let bot = botByDid.get(doc.did);
    if (bot === undefined) {
      bot = await isDeclaredBot(doc.did);
      botByDid.set(doc.did, bot);
    }
    const prev = getScanState(db, doc.uri);
    if (bot && !(prev?.labeled ?? false)) {
      const signed = await signLabel(keypair, {
        ver: 1,
        src: config.labelerDid,
        uri: doc.uri,
        val: config.labelValue,
        cts: new Date().toISOString(),
      });
      insertLabel(db, signed);
      labeled++;
      console.log(`  +bot ${doc.uri}`);
    }
    setScanState(db, doc.uri, {
      version: config.detectorVersion,
      labeled: bot,
    });
  }

  const bots = [...botByDid.values()].filter((b) => b).length;
  console.log(
    `\n[backfill] done: ${docs.length} docs from ${botByDid.size} authors; ${bots} bot author(s); labeled ${labeled}.`,
  );
}

try {
  await main();
} catch (error) {
  console.error("[backfill] fatal", error);
  process.exitCode = 1;
}
