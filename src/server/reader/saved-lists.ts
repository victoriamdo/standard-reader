/**
 * Saved publication lists as virtual subscriptions.
 *
 * Saving another reader's `app.standard-reader.list` (via an
 * `app.standard-reader.listSave` record) acts like following every
 * publication in it — those publications join the reader's *effective* follow
 * set used by the sidebar, feeds, and unread counts, without writing
 * individual `site.standard.graph.subscription` records.
 *
 * Lists are NOT mirrored into the Neon read-model: both the reader's
 * `listSave` records and the referenced list records are public, so they're
 * fetched straight from the owning PDSes (strongly consistent). Because the
 * effective follow set is consulted on hot feed paths, the per-reader
 * resolution is cached in-memory for a short TTL and explicitly invalidated
 * when the reader saves/unsaves a list.
 */

import type { Db, Schema } from "#/integrations/tanstack-query/api-shapes";

import { APP_NSID } from "#/lib/atproto/nsids";
import { resolveIdentity } from "#/server/atproto/identity";
import { selectFollowUris } from "#/server/reader/queries";

const RECORD_FETCH_TIMEOUT_MS = 8000;
const LIST_RECORDS_PAGE = 100;
/** How long a reader's resolved saved lists are reused across feed queries. */
const SAVED_LISTS_TTL_MS = 60_000;

/** `at://did/app.standard-reader.list/rkey` → did + rkey capture groups. */
const LIST_URI_RE = new RegExp(
  `^at://([^/]+)/${APP_NSID.list.replaceAll(".", String.raw`\.`)}/([^/]+)$`,
);

export interface SubscriptionList {
  uri: string;
  rkey: string;
  name: string;
  description: string | null;
  /** Ordered at-uris of the `site.standard.publication` records in the list. */
  publications: Array<string>;
  createdAt: string | null;
}

export function listUriFromParams(did: string, rkey: string): string {
  return `at://${did}/${APP_NSID.list}/${rkey}`;
}

/** Route-style params parsed from a list AT-URI, or null when malformed. */
export function listRefFromUri(
  uri: string,
): { did: string; rkey: string } | null {
  const match = LIST_URI_RE.exec(uri);
  return match ? { did: match[1] as string, rkey: match[2] as string } : null;
}

/** Permissive mapping — repos may hold minimal or malformed records. */
export function toSubscriptionList(
  uri: string,
  rkey: string,
  value: unknown,
): SubscriptionList | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || !Array.isArray(record.publications)) {
    return null;
  }
  return {
    uri,
    rkey,
    name: record.name,
    description:
      typeof record.description === "string" ? record.description : null,
    publications: record.publications.filter(
      (item): item is string => typeof item === "string",
    ),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
  };
}

/** Fetch one `app.standard-reader.list` from its owner's PDS, unauthenticated. */
export async function fetchPublicList(
  did: string,
  rkey: string,
): Promise<SubscriptionList | null> {
  const identity = await resolveIdentity(did);
  if (!identity.pds) {
    return null;
  }
  try {
    const url = new URL("/xrpc/com.atproto.repo.getRecord", identity.pds);
    url.searchParams.set("repo", did);
    url.searchParams.set("collection", APP_NSID.list);
    url.searchParams.set("rkey", rkey);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(RECORD_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { value?: unknown };
    return toSubscriptionList(listUriFromParams(did, rkey), rkey, body.value);
  } catch {
    return null;
  }
}

/** List uris referenced by the reader's `listSave` records (public read). */
async function listSavedListUris(did: string): Promise<Array<string>> {
  const identity = await resolveIdentity(did);
  if (!identity.pds) {
    return [];
  }
  const uris = new Set<string>();
  let cursor: string | undefined;
  try {
    do {
      const url = new URL("/xrpc/com.atproto.repo.listRecords", identity.pds);
      url.searchParams.set("repo", did);
      url.searchParams.set("collection", APP_NSID.listSave);
      url.searchParams.set("limit", String(LIST_RECORDS_PAGE));
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }
      const res = await fetch(url, {
        signal: AbortSignal.timeout(RECORD_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        break;
      }
      const body = (await res.json()) as {
        cursor?: string;
        records?: Array<{ value?: { list?: unknown } }>;
      };
      for (const record of body.records ?? []) {
        if (typeof record.value?.list === "string") {
          uris.add(record.value.list);
        }
      }
      cursor =
        (body.records?.length ?? 0) === LIST_RECORDS_PAGE
          ? body.cursor
          : undefined;
    } while (cursor);
  } catch {
    // Treat an unreachable PDS as "no saved lists" rather than failing feeds.
  }
  return [...uris];
}

interface CacheEntry {
  lists: Array<SubscriptionList>;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Array<SubscriptionList>>>();

/**
 * The reader's saved lists (excluding saves that point at their own lists),
 * resolved from the PDSes and cached for {@link SAVED_LISTS_TTL_MS}.
 */
export async function savedListsForReader(
  did: string,
): Promise<Array<SubscriptionList>> {
  const cached = cache.get(did);
  if (cached && cached.expires > Date.now()) {
    return cached.lists;
  }
  const pending = inflight.get(did);
  if (pending) {
    return pending;
  }
  const promise = (async () => {
    const savedUris = await listSavedListUris(did);
    const refs = savedUris
      .map((uri) => listRefFromUri(uri))
      .filter((ref): ref is { did: string; rkey: string } => ref !== null)
      // A save of your own list would just duplicate the sidebar group.
      .filter((ref) => ref.did !== did);
    const fetched = await Promise.all(
      refs.map((ref) => fetchPublicList(ref.did, ref.rkey)),
    );
    const lists = fetched.filter(
      (list): list is SubscriptionList => list !== null,
    );
    cache.set(did, { lists, expires: Date.now() + SAVED_LISTS_TTL_MS });
    return lists;
  })();
  inflight.set(did, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(did);
  }
}

/** Bust the cache after the reader saves/unsaves a list. */
export function invalidateSavedLists(did: string): void {
  cache.delete(did);
}

/** Distinct publication uris contributed by the reader's saved lists. */
export async function savedListPublicationUris(
  did: string,
): Promise<Array<string>> {
  const lists = await savedListsForReader(did);
  return [...new Set(lists.flatMap((list) => list.publications))];
}

/**
 * The reader's *effective* follow set: real subscriptions plus every
 * publication in their saved lists. This is what the sidebar, feeds, and
 * unread counts operate on — saving a list acts like following its members.
 */
export async function effectiveFollowUris(
  db: Db,
  schema: Schema,
  did: string,
): Promise<Array<string>> {
  const [followUris, listUris] = await Promise.all([
    selectFollowUris(db, schema, did),
    savedListPublicationUris(did),
  ]);
  return [...new Set([...followUris, ...listUris])];
}
