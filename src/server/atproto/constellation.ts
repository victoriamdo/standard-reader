/**
 * Constellation backlink index client — discovers records that link to a URL,
 * AT-URI, or DID across the network.
 *
 * @see https://constellation.microcosm.blue/
 */

export interface ConstellationBacklinkRecord {
  did: string;
  collection: string;
  rkey: string;
}

export interface ConstellationBacklinksResult {
  total: number;
  records: Array<ConstellationBacklinkRecord>;
  cursor: string | null;
}

const DEFAULT_CONSTELLATION_URL = "https://constellation.microcosm.blue";
const FETCH_TIMEOUT_MS = 8000;
const BSKY_POST_COLLECTION = "app.bsky.feed.post";
const MARGIN_TARGET_PATH = ".target.source";
const MARGIN_REPLY_ROOT_PATH = ".root.uri";

/** JSON paths in `app.bsky.feed.post` where a linked URL may appear. */
export const BSKY_POST_LINK_PATHS = [
  ".embed.external.uri",
  ".facets[].features[app.bsky.richtext.facet#link].uri",
] as const;

/** Bluesky post link sources as `collection:path` for the xrpc API. */
export const BSKY_POST_LINK_SOURCES = BSKY_POST_LINK_PATHS.map(
  (path) => `${BSKY_POST_COLLECTION}:${path}` as const,
);

/** Margin note collections indexed by Constellation at `target.source`. */
export const MARGIN_NOTE_COLLECTIONS = [
  "at.margin.note",
  "at.margin.annotation",
  "at.margin.highlight",
] as const;

/** Cosmik card collection (Margin / Semble) indexed at page URL fields. */
export const COSMIK_CARD_COLLECTION = "network.cosmik.card";

/** JSON paths on `network.cosmik.card` where a linked URL may appear. */
export const COSMIK_CARD_URL_PATHS = [".url", ".content.url"] as const;

/** Margin + cosmik collections merged into Discussion. */
export const MARGIN_DISCUSSION_COLLECTIONS = [
  ...MARGIN_NOTE_COLLECTIONS,
  COSMIK_CARD_COLLECTION,
] as const;

/** Margin note link sources as legacy `/links` collection + path specs. */
export const MARGIN_NOTE_LINK_SOURCES = MARGIN_NOTE_COLLECTIONS.map(
  (collection) => `${collection}:${MARGIN_TARGET_PATH}` as const,
);

/** Cosmik card link sources as legacy `/links` collection + path specs. */
export const COSMIK_CARD_LINK_SOURCES = COSMIK_CARD_URL_PATHS.map(
  (path) => `${COSMIK_CARD_COLLECTION}:${path}` as const,
);

/** All margin Discussion link sources (at.margin.* + network.cosmik.card). */
export const MARGIN_DISCUSSION_LINK_SOURCES = [
  ...MARGIN_NOTE_LINK_SOURCES,
  ...COSMIK_CARD_LINK_SOURCES,
] as const;

/** Constellation source for `at.margin.reply` records pointing at a note root. */
export const MARGIN_REPLY_LINK_SOURCE =
  `at.margin.reply:${MARGIN_REPLY_ROOT_PATH}` as const;

function constellationBaseUrl(): string {
  const configured = process.env.CONSTELLATION_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_CONSTELLATION_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(target: string): boolean {
  return /^https?:\/\//i.test(target);
}

function parseSourceSpec(source: string): {
  collection: string;
  path: string;
} | null {
  const colon = source.indexOf(":");
  if (colon <= 0) return null;
  const collection = source.slice(0, colon);
  const path = source.slice(colon + 1);
  if (!collection || !path) return null;
  return { collection, path };
}

function parseBacklinkRecord(
  value: unknown,
): ConstellationBacklinkRecord | null {
  if (!isRecord(value)) return null;
  const { did, collection, rkey } = value;
  if (
    typeof did !== "string" ||
    typeof collection !== "string" ||
    typeof rkey !== "string"
  ) {
    return null;
  }
  if (!did.startsWith("did:") || !collection || !rkey) return null;
  return { did, collection, rkey };
}

function constellationHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "User-Agent": "standard-reader (comments)",
  };
}

function parseBacklinksPayload(payload: unknown): ConstellationBacklinksResult {
  const empty: ConstellationBacklinksResult = {
    total: 0,
    records: [],
    cursor: null,
  };
  if (!isRecord(payload)) return empty;

  const rawRecords = payload.records ?? payload.linking_records;
  const records = Array.isArray(rawRecords)
    ? rawRecords
        .map((row) => parseBacklinkRecord(row))
        .filter((row): row is ConstellationBacklinkRecord => row != null)
    : [];

  const total =
    typeof payload.total === "number" ? payload.total : records.length;
  const nextCursor =
    typeof payload.cursor === "string" && payload.cursor.length > 0
      ? payload.cursor
      : null;

  return { total, records, cursor: nextCursor };
}

function parseBacklinksCountPayload(payload: unknown): number {
  if (!isRecord(payload)) return 0;
  return typeof payload.total === "number" ? payload.total : 0;
}

function parseLegacyCountBody(body: string): number {
  const trimmed = body.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Total backlinks for one target + source via Constellation's count endpoint.
 * Best-effort; returns 0 on timeout or any network/parse failure.
 */
async function fetchBacklinksCount({
  target,
  source,
}: {
  target: string;
  source: string;
}): Promise<number> {
  if (!target.trim() || !source.trim()) return 0;

  const parsed = parseSourceSpec(source);
  if (!parsed) return 0;

  try {
    const useLegacyLinks = isHttpUrl(target);
    const url = useLegacyLinks
      ? new URL("/links/count", constellationBaseUrl())
      : new URL(
          "/xrpc/blue.microcosm.links.getBacklinksCount",
          constellationBaseUrl(),
        );

    if (useLegacyLinks) {
      url.searchParams.set("target", target);
      url.searchParams.set("collection", parsed.collection);
      url.searchParams.set("path", parsed.path);
    } else {
      url.searchParams.set("subject", target);
      url.searchParams.set("source", source);
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: constellationHeaders(),
    });
    if (!response.ok) return 0;

    if (useLegacyLinks) {
      return parseLegacyCountBody(await response.text());
    }

    return parseBacklinksCountPayload(await response.json());
  } catch {
    return 0;
  }
}

async function fetchBacklinksPage({
  target,
  source,
  cursor,
  limit,
}: {
  target: string;
  source: string;
  cursor?: string;
  limit: number;
}): Promise<ConstellationBacklinksResult> {
  const empty: ConstellationBacklinksResult = {
    total: 0,
    records: [],
    cursor: null,
  };

  if (!target.trim() || !source.trim()) return empty;

  const parsed = parseSourceSpec(source);
  if (!parsed) return empty;

  try {
    // The xrpc endpoint rejects https?:// subjects (400); use legacy /links
    // for web URLs. AT-URI and DID subjects work on xrpc.
    const useLegacyLinks = isHttpUrl(target);
    const url = useLegacyLinks
      ? new URL("/links", constellationBaseUrl())
      : new URL(
          "/xrpc/blue.microcosm.links.getBacklinks",
          constellationBaseUrl(),
        );

    if (useLegacyLinks) {
      url.searchParams.set("target", target);
      url.searchParams.set("collection", parsed.collection);
      url.searchParams.set("path", parsed.path);
    } else {
      url.searchParams.set("subject", target);
      url.searchParams.set("source", source);
    }
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: constellationHeaders(),
    });
    if (!response.ok) return empty;

    return parseBacklinksPayload(await response.json());
  } catch {
    return empty;
  }
}

/**
 * Fetch records linking to `target` via the given `source` collection:path spec.
 * Returns empty on timeout or any network/parse failure (best-effort).
 */
export async function getBacklinks({
  target,
  source,
  cursor,
  limit = 100,
}: {
  target: string;
  source: string;
  cursor?: string;
  limit?: number;
}): Promise<ConstellationBacklinksResult> {
  return fetchBacklinksPage({ target, source, cursor, limit });
}

/** Fetch all pages of backlinks for one target + source. */
async function getAllBacklinksForSource(
  target: string,
  source: string,
): Promise<Array<ConstellationBacklinkRecord>> {
  const merged: Array<ConstellationBacklinkRecord> = [];
  let cursor: string | undefined;

  do {
    const page = await fetchBacklinksPage({
      target,
      source,
      cursor,
      limit: 100,
    });
    merged.push(...page.records);
    cursor = page.cursor ?? undefined;
  } while (cursor);

  return merged;
}

/**
 * Cheap backlink total for trending — Constellation count endpoint per source.
 * Best-effort; returns 0 on failure.
 */
export async function getBacklinkCountForTarget(
  target: string,
): Promise<number> {
  if (!target.trim()) return 0;

  const totals = await Promise.all(
    BSKY_POST_LINK_SOURCES.map((source) =>
      fetchBacklinksCount({ target, source }),
    ),
  );

  return totals.reduce((sum, n) => sum + n, 0);
}

function mergeBacklinkRecords(
  results: Array<Array<ConstellationBacklinkRecord>>,
  collections: ReadonlySet<string>,
): Array<ConstellationBacklinkRecord> {
  const seen = new Set<string>();
  const merged: Array<ConstellationBacklinkRecord> = [];

  for (const records of results) {
    for (const record of records) {
      if (!collections.has(record.collection)) continue;
      const key = `${record.did}/${record.collection}/${record.rkey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(record);
    }
  }

  return merged;
}

/** Query all configured Bluesky post link sources for a target. */
export async function getPostBacklinksForTarget(
  target: string,
): Promise<Array<ConstellationBacklinkRecord>> {
  const results = await Promise.all(
    BSKY_POST_LINK_SOURCES.map((source) =>
      getAllBacklinksForSource(target, source),
    ),
  );

  return mergeBacklinkRecords(results, new Set([BSKY_POST_COLLECTION]));
}

/** Query all configured margin Discussion link sources for a target URL. */
export async function getMarginNoteBacklinksForTarget(
  target: string,
): Promise<Array<ConstellationBacklinkRecord>> {
  const results = await Promise.all(
    MARGIN_DISCUSSION_LINK_SOURCES.map((source) =>
      getAllBacklinksForSource(target, source),
    ),
  );

  return mergeBacklinkRecords(
    results,
    new Set(MARGIN_DISCUSSION_COLLECTIONS),
  );
}

/** Cheap margin-note total for one URL (deduped across margin collections). */
export async function getMarginNoteBacklinkCountForTarget(
  target: string,
): Promise<number> {
  const records = await getMarginNoteBacklinksForTarget(target);
  return records.length;
}

/** Reply count for a margin note AT-URI via Constellation. */
export async function getMarginReplyCountForNote(
  noteUri: string,
): Promise<number> {
  if (!noteUri.startsWith("at://")) return 0;
  return fetchBacklinksCount({
    target: noteUri,
    source: MARGIN_REPLY_LINK_SOURCE,
  });
}
