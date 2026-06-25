/**
 * Bot detection: an account is a "bot" if its `app.bsky.actor.profile` record
 * carries a `bot` self-label.
 *
 * Self-labels live in the profile record's `labels` field as a
 * `com.atproto.label.defs#selfLabels` object (`{ values: [{ val: "bot" }] }`).
 * That's the only on-network way an account *declares itself* automated — there
 * is no boolean flag on the profile. We read the record straight from the
 * author's PDS and cache the verdict per DID.
 */

const PROFILE_COLLECTION = "app.bsky.actor.profile";
const VERDICT_TTL_MS = 30 * 60_000;
const PDS_TTL_MS = 60 * 60_000;

interface SelfLabels {
  values?: Array<{ val?: string }>;
}
interface ProfileRecord {
  labels?: SelfLabels | Record<string, unknown>;
}

/** Pure check: does this profile record self-declare `bot`? */
export function hasBotSelfLabel(
  record: ProfileRecord | null | undefined,
): boolean {
  const labels = record?.labels as SelfLabels | undefined;
  const values = labels?.values;
  return Array.isArray(values) && values.some((v) => v?.val === "bot");
}

async function fetchJson<T>(url: string, ms = 4000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const pdsCache = new Map<string, { at: number; endpoint: string | null }>();

async function resolvePds(did: string): Promise<string | null> {
  const cached = pdsCache.get(did);
  if (cached && Date.now() - cached.at < PDS_TTL_MS) return cached.endpoint;

  let docUrl: string | null = null;
  if (did.startsWith("did:plc:")) docUrl = `https://plc.directory/${did}`;
  else if (did.startsWith("did:web:")) {
    const host = decodeURIComponent(did.slice("did:web:".length).split(":")[0]);
    docUrl = `https://${host}/.well-known/did.json`;
  }

  let endpoint: string | null = null;
  if (docUrl) {
    const doc = await fetchJson<{
      service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
    }>(docUrl);
    endpoint =
      doc?.service
        ?.find(
          (s) =>
            s.type === "AtprotoPersonalDataServer" || s.id === "#atproto_pds",
        )
        ?.serviceEndpoint?.replace(/\/$/, "") ?? null;
  }
  pdsCache.set(did, { at: Date.now(), endpoint });
  return endpoint;
}

const verdictCache = new Map<string, { at: number; bot: boolean }>();

/** Whether `did` has self-declared as a bot (cached). */
export async function isDeclaredBot(did: string): Promise<boolean> {
  const cached = verdictCache.get(did);
  if (cached && Date.now() - cached.at < VERDICT_TTL_MS) return cached.bot;

  let bot = false;
  const pds = await resolvePds(did);
  if (pds) {
    const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.set("repo", did);
    url.searchParams.set("collection", PROFILE_COLLECTION);
    url.searchParams.set("rkey", "self");
    const res = await fetchJson<{ value?: ProfileRecord }>(url.toString());
    bot = hasBotSelfLabel(res?.value);
  }
  verdictCache.set(did, { at: Date.now(), bot });
  return bot;
}
