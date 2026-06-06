/**
 * DID → identity resolution (PDS endpoint + handle), used to build blob URLs
 * for standard.site assets and to enrich profiles. Resolution is cached in a
 * module-level Map so repeated lookups during a backfill are cheap (see the
 * "cache repeated function calls" guidance) and survive across requests on a
 * warm serverless instance.
 */

export interface ResolvedIdentity {
  did: string;
  /** PDS service endpoint, e.g. `https://pds.example.com`. */
  pds: string | null;
  /** Primary handle from `alsoKnownAs`, e.g. `alice.bsky.social`. */
  handle: string | null;
}

interface DidDocument {
  id?: string;
  alsoKnownAs?: Array<string>;
  service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
}

const cache = new Map<string, ResolvedIdentity>();
/** In-flight resolutions, so a burst of events for the same DID shares one
 * network request instead of spawning thousands of concurrent fetches. */
const inflight = new Map<string, Promise<ResolvedIdentity>>();

const PLC_URL = process.env.TAP_PLC_URL || "https://plc.directory";
/** Hard cap on each DID-doc fetch so a slow/hanging PLC can't pile up unbounded
 * pending promises (which previously exhausted memory under firehose load). */
const FETCH_TIMEOUT_MS = 8000;

function pdsFromDoc(doc: DidDocument): string | null {
  const service = doc.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
  );
  return service?.serviceEndpoint ?? null;
}

function handleFromDoc(doc: DidDocument): string | null {
  const aka = doc.alsoKnownAs?.find((value) => value.startsWith("at://"));
  return aka ? aka.slice("at://".length) : null;
}

async function fetchDidDoc(did: string): Promise<DidDocument | null> {
  try {
    let url: string | null = null;
    if (did.startsWith("did:plc:")) {
      url = `${PLC_URL}/${encodeURIComponent(did)}`;
    } else if (did.startsWith("did:web:")) {
      const host = did.slice("did:web:".length).replaceAll(":", "/");
      url = `https://${host}/.well-known/did.json`;
    }
    if (!url) {
      return null;
    }
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as DidDocument;
  } catch {
    return null;
  }
}

/**
 * Resolve a DID to its PDS + handle. Cached; failures resolve to a row with
 * null fields (still cached briefly to avoid hammering PLC during backfill).
 */
export async function resolveIdentity(did: string): Promise<ResolvedIdentity> {
  const cached = cache.get(did);
  if (cached) {
    return cached;
  }
  const pending = inflight.get(did);
  if (pending) {
    return pending;
  }
  const promise = (async () => {
    const doc = await fetchDidDoc(did);
    const resolved: ResolvedIdentity = doc
      ? { did, pds: pdsFromDoc(doc), handle: handleFromDoc(doc) }
      : { did, pds: null, handle: null };
    cache.set(did, resolved);
    return resolved;
  })();
  inflight.set(did, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(did);
  }
}

/** Return an already-known identity without doing network I/O. Use this in the
 * hot tap webhook path so acknowledgements are not blocked on PLC/PDS lookups. */
export function getCachedIdentity(did: string): ResolvedIdentity | null {
  return cache.get(did) ?? null;
}

/** Seed/refresh the identity cache from a known handle (e.g. a tap identity
 * event), without forcing a network round-trip. */
export function primeIdentityHandle(did: string, handle: string): void {
  const existing = cache.get(did);
  cache.set(did, {
    did,
    pds: existing?.pds ?? null,
    handle,
  });
}
