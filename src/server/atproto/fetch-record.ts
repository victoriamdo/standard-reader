import { parseAtUri } from "#/server/atproto/uri";

const DEFAULT_SLINGSHOT_URL = "https://slingshot.microcosm.blue";
/** Default per-request timeout for unauthenticated repo reads. */
const DEFAULT_FETCH_TIMEOUT_MS = 8000;

/** Slingshot is a caching proxy over repo records; faster and more reliable
 * than hitting the author's PDS directly (which may be slow or unreachable). */
export function slingshotBaseUrl(): string {
  const configured = process.env.SLINGSHOT_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_SLINGSHOT_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface RecordResponse {
  /** The record value (`payload.value`); null when the record can't be fetched. */
  value: unknown | null;
  /** The base URL that served the record — useful for callers (e.g. gallery)
   * that need to know which host the blob URLs should target. */
  base: string;
}

async function getRecordFromBase(
  base: string,
  parsed: { did: string; collection: string; rkey: string },
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<RecordResponse | null> {
  const cleanBase = base.replace(/\/+$/, "");
  const params = new URLSearchParams({
    repo: parsed.did,
    collection: parsed.collection,
    rkey: parsed.rkey,
  });
  const url = `${cleanBase}/xrpc/com.atproto.repo.getRecord?${params}`;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.value)) return null;
    return { value: payload.value, base: cleanBase };
  } catch {
    return null;
  }
}

/**
 * Fetch a repo record value (with the base URL that served it).
 *
 * Tries Slingshot (a caching proxy aggregating repo records) first, then falls
 * back to the author's PDS when Slingshot doesn't have the record. `pds` is
 * optional — omit it when the caller doesn't already know the PDS; this fn
 * only needs it for the fallback and can fetch from Slingshot alone when null.
 *
 * This is the only unauthenticated repo-record read primitive in the codebase.
 * Write-path freshness reads (edit-after-create) must use the authenticated
 * `@atcute/client` `getRecord` instead — Slingshot is a cache and can lag.
 */
export async function fetchRepoRecordWithFallback(
  uri: string,
  pds?: string | null,
  timeoutMs?: number,
): Promise<RecordResponse | null> {
  const parsed = parseAtUri(uri);
  if (!parsed) return null;

  const fromSlingshot = await getRecordFromBase(
    slingshotBaseUrl(),
    parsed,
    timeoutMs,
  );
  if (fromSlingshot) return fromSlingshot;

  if (pds) {
    const fromPds = await getRecordFromBase(pds, parsed, timeoutMs);
    if (fromPds) return fromPds;
  }
  return null;
}
