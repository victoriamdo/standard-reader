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

const PLC_URL = process.env.TAP_PLC_URL || "https://plc.directory";

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
    if (did.startsWith("did:plc:")) {
      const res = await fetch(`${PLC_URL}/${encodeURIComponent(did)}`);
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as DidDocument;
    }
    if (did.startsWith("did:web:")) {
      const host = did.slice("did:web:".length).replaceAll(":", "/");
      const res = await fetch(`https://${host}/.well-known/did.json`);
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as DidDocument;
    }
  } catch {
    return null;
  }
  return null;
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
  const doc = await fetchDidDoc(did);
  const resolved: ResolvedIdentity = doc
    ? { did, pds: pdsFromDoc(doc), handle: handleFromDoc(doc) }
    : { did, pds: null, handle: null };
  cache.set(did, resolved);
  return resolved;
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
