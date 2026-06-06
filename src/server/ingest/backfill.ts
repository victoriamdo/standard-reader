import type { TapEvent } from "../atproto/types.ts";

import { resolveIdentity } from "../atproto/identity.ts";
import { Collections, parseAtUri } from "../atproto/uri.ts";
import { processTapEvent } from "./consumer.ts";
import { recomputeDerived } from "./recompute.ts";

/**
 * Direct network backfill that reuses the tap consumer pipeline.
 *
 * `tap` is the production ingestion transport (firehose + live sync). This tool
 * does the *backfill* half directly over HTTP — discovering repos that hold
 * standard.site records and reading their records via `com.atproto.repo.list
 * Records` — then feeds each record through `processTapEvent` exactly as a tap
 * `live:false` event. Handy for local testing without running tap, and as a
 * one-shot seeding/repair tool in prod.
 */

const RELAY_URL =
  process.env.RELAY_HTTP_URL || "https://relay1.us-east.bsky.network";

const DISCOVER_COLLECTIONS = [
  Collections.publication,
  Collections.document,
  Collections.subscription,
  Collections.recommend,
];

const RECORD_COLLECTIONS = [
  Collections.publication,
  Collections.document,
  Collections.subscription,
  Collections.recommend,
  Collections.bskyProfile,
];

export interface BackfillOptions {
  /** Cap on the number of repos to backfill (across all discovered DIDs). */
  maxRepos?: number;
  /** Cap on records pulled per (repo, collection). */
  maxRecordsPerCollection?: number;
  /** Explicit DIDs to backfill instead of network discovery. */
  dids?: Array<string>;
  /** Recompute derived data (stats/cosub/topics) at the end. Default true. */
  recompute?: boolean;
  /** Progress logger. */
  log?: (message: string) => void;
}

export interface BackfillResult {
  repos: number;
  records: number;
  ok: number;
  failed: number;
}

interface ListRecordsResponse {
  records?: Array<{
    uri: string;
    cid?: string;
    value?: Record<string, unknown>;
  }>;
  cursor?: string;
}

interface ListReposResponse {
  repos?: Array<{ did: string }>;
  cursor?: string;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Discover DIDs of repos that hold at least one record in a collection. */
async function discoverDids(
  collection: string,
  into: Set<string>,
  cap: number,
): Promise<void> {
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ collection, limit: "200" });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const data = await getJson<ListReposResponse>(
      `${RELAY_URL}/xrpc/com.atproto.sync.listReposByCollection?${params}`,
    );
    if (!data?.repos) {
      return;
    }
    for (const repo of data.repos) {
      into.add(repo.did);
      if (into.size >= cap) {
        return;
      }
    }
    cursor = data.cursor;
  } while (cursor);
}

/** Read all (capped) records of a collection from a repo's PDS. */
async function listRecords(
  pds: string,
  did: string,
  collection: string,
  cap: number,
): Promise<
  Array<{ uri: string; cid?: string; value?: Record<string, unknown> }>
> {
  const base = pds.replace(/\/+$/, "");
  const out: Array<{
    uri: string;
    cid?: string;
    value?: Record<string, unknown>;
  }> = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({
      repo: did,
      collection,
      limit: "100",
    });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const data = await getJson<ListRecordsResponse>(
      `${base}/xrpc/com.atproto.repo.listRecords?${params}`,
    );
    if (!data?.records || data.records.length === 0) {
      break;
    }
    out.push(...data.records);
    if (out.length >= cap) {
      return out.slice(0, cap);
    }
    cursor = data.cursor;
  } while (cursor);
  return out;
}

export async function backfill(
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const maxRepos = options.maxRepos ?? 50;
  const maxRecords = options.maxRecordsPerCollection ?? 500;
  const log = options.log ?? (() => {});

  // 1. Determine the repo set.
  let dids: Array<string>;
  if (options.dids && options.dids.length > 0) {
    dids = options.dids.slice(0, maxRepos);
  } else {
    const set = new Set<string>();
    for (const collection of DISCOVER_COLLECTIONS) {
      if (set.size >= maxRepos) {
        break;
      }
      await discoverDids(collection, set, maxRepos);
      log(`discovered ${set.size} repo(s) after ${collection}`);
    }
    dids = [...set].slice(0, maxRepos);
  }
  log(`backfilling ${dids.length} repo(s)`);

  // 2. Backfill each repo through the consumer.
  const result: BackfillResult = { repos: 0, records: 0, ok: 0, failed: 0 };
  let eventId = 0;

  for (const did of dids) {
    const identity = await resolveIdentity(did);
    if (identity.handle) {
      eventId += 1;
      const event: TapEvent = {
        id: eventId,
        type: "identity",
        identity: { did, handle: identity.handle, isActive: true },
      };
      const applied = await processTapEvent(event);
      result.ok += applied ? 1 : 0;
      result.failed += applied ? 0 : 1;
    }
    if (!identity.pds) {
      log(`skip ${did}: no PDS`);
      continue;
    }

    for (const collection of RECORD_COLLECTIONS) {
      const records = await listRecords(
        identity.pds,
        did,
        collection,
        maxRecords,
      );
      for (const record of records) {
        const parsed = parseAtUri(record.uri);
        if (!parsed) {
          continue;
        }
        eventId += 1;
        result.records += 1;
        const event: TapEvent = {
          id: eventId,
          type: "record",
          record: {
            live: false,
            rev: "",
            did,
            collection,
            rkey: parsed.rkey,
            action: "create",
            cid: record.cid,
            record: record.value,
          },
        };
        const applied = await processTapEvent(event);
        result.ok += applied ? 1 : 0;
        result.failed += applied ? 0 : 1;
      }
    }
    result.repos += 1;
    log(
      `[${result.repos}/${dids.length}] ${did} — ${result.records} records so far`,
    );
  }

  // 3. Derived data.
  if (options.recompute !== false) {
    log("recomputing derived data…");
    await recomputeDerived();
  }
  return result;
}
