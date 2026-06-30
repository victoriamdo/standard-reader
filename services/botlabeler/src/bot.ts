/**
 * Bot detection: an account is a "bot" if its `app.bsky.actor.profile` record
 * carries a `bot` self-label.
 *
 * Self-labels live in the profile record's `labels` field as a
 * `com.atproto.label.defs#selfLabels` object (`{ values: [{ val: "bot" }] }`).
 * That's the only on-network way an account *declares itself* automated — there
 * is no boolean flag on the profile. We read the record through Slingshot
 * (a caching proxy that aggregates repo records across PDSes) so we don't have
 * to resolve each author's PDS, and we cache the verdict per DID.
 */

const PROFILE_COLLECTION = "app.bsky.actor.profile";
const PROFILE_RKEY = "self";
const VERDICT_TTL_MS = 30 * 60_000;
const DEFAULT_SLINGSHOT_URL = "https://slingshot.microcosm.blue";

/** Slingshot is a caching proxy over repo records; faster and more reliable
 * than resolving + hitting each author's PDS directly. */
function slingshotBaseUrl(): string {
  const configured = process.env.SLINGSHOT_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_SLINGSHOT_URL;
}

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

const verdictCache = new Map<string, { at: number; bot: boolean }>();

/** Whether `did` has self-declared as a bot (cached). */
export async function isDeclaredBot(did: string): Promise<boolean> {
  const cached = verdictCache.get(did);
  if (cached && Date.now() - cached.at < VERDICT_TTL_MS) return cached.bot;

  let bot = false;
  const url = new URL("/xrpc/com.atproto.repo.getRecord", slingshotBaseUrl());
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", PROFILE_COLLECTION);
  url.searchParams.set("rkey", PROFILE_RKEY);
  const res = await fetchJson<{ value?: ProfileRecord }>(url.toString());
  bot = hasBotSelfLabel(res?.value);
  verdictCache.set(did, { at: Date.now(), bot });
  return bot;
}
