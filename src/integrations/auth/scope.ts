import { scope as atprotoScope } from "@atcute/oauth-node-client";
import { APP_NSID, STANDARD_NSID } from "#/lib/atproto/nsids";

/** Required on every ATProto OAuth session (see atproto.com/specs/oauth). */
export const ATPROTO_BASE_SCOPE = "atproto";

/**
 * Blob upload for image-bearing records. The `blob` resource cannot live
 * inside a permission set, so it's always requested as a granular scope
 * alongside the `include:` sets.
 */
const BLOB_SCOPE = atprotoScope.blob({ accept: ["image/*"] });

/**
 * Permission-set scope strings published by Standard Reader and standard.site.
 * See APP_VISION.md §5 "OAuth scopes" for the full design.
 *
 * App-owned sets (we publish these as lexicons in `lexicons/app/standard-reader/`):
 *  - `app.standard-reader.authBasicFeatures` — reader-state: bookmark, read, list,
 *    listSave, labelerSubscription (legacy) + labeler.subscription (V2).
 *  - `app.standard-reader.authCollections` — collections-authoring state:
 *    collection, collectionsPublication, publicationTheme.
 *
 * standard.site sets (published upstream, we reference via `include:`):
 *  - `site.standard.authSocial` — site.standard.graph.subscription + .recommend
 *    (follows + likes).
 *  - `site.standard.authFull` — all four site.standard.* collections
 *    (publication + document + subscription + recommend).
 */
const AUTH_BASIC_FEATURES = "include:app.standard-reader.authBasicFeatures";
const AUTH_COLLECTIONS = "include:app.standard-reader.authCollections";
const SITE_AUTH_SOCIAL = "include:site.standard.authSocial";
const SITE_AUTH_FULL = "include:site.standard.authFull";

/**
 * Basic sign-in scope — what 95% of readers need. Covers app-owned reader-state
 * (`authBasicFeatures`) plus standard.site follows & likes (`authSocial`).
 */
export const basicScope = [
  ATPROTO_BASE_SCOPE,
  BLOB_SCOPE,
  AUTH_BASIC_FEATURES,
  SITE_AUTH_SOCIAL,
];

/**
 * Collections-authoring scope — basic plus app-owned collections state
 * (`authCollections`) and full standard.site record access (`authFull`,
 * replacing `authSocial` so publication/document writes are allowed).
 */
export const collectionsScope = [
  // basicScope minus the site.standard.authSocial set (replaced by authFull).
  ...basicScope.filter((s) => s !== SITE_AUTH_SOCIAL),
  AUTH_COLLECTIONS,
  SITE_AUTH_FULL,
];

/**
 * Minimal scope for the publication subscribe embed (subscription write only).
 * `authSocial` is the smallest published set covering `subscription`; it also
 * grants `recommend`, which matches the standard.site consent UX.
 */
export const subscribeScope = [ATPROTO_BASE_SCOPE, SITE_AUTH_SOCIAL];

/**
 * Every scope string we may request at authorize time. ATProto OAuth requires
 * each requested scope to appear in client metadata (a single-collection `repo`
 * scope is not treated as a subset of a multi-collection one; the same applies
 * to `include:` set scopes).
 */
export const clientMetadataScope = [
  ...new Set([...basicScope, ...collectionsScope, ...subscribeScope]),
];

export type AuthScopeIntent = "basic" | "collections" | "subscribe";

const SCOPE_BY_INTENT: Record<AuthScopeIntent, Array<string>> = {
  basic: basicScope,
  collections: collectionsScope,
  subscribe: subscribeScope,
};

/** Serialize OAuth scope entries for the authorize request. */
export function formatOAuthScope(entries: Array<string>): string {
  return entries.join(" ");
}

/**
 * User row shape consulted for progressive scope upgrades. Only the
 * `collectionsAuthoringEnabled` flag is read here.
 */
export interface ScopeUserLookup {
  collectionsAuthoringEnabled: boolean | null;
}

/**
 * Resolve the OAuth scope string for an authorize request. If the user has
 * opted into collections authoring (the flag is set on their `user` row),
 * automatically upgrade to the collections tier so subsequent logins silently
 * include the expanded scopes. Explicit `intent: "collections"` (the upgrade
 * flow itself) and `intent: "subscribe"` (the subscribe embed) override the
 * flag.
 */
export function resolveAuthScopeForUser(
  user: ScopeUserLookup | null | undefined,
  intent: AuthScopeIntent | undefined,
): string {
  if (intent === "subscribe") {
    return formatOAuthScope(SCOPE_BY_INTENT.subscribe);
  }
  if (intent === "collections" || user?.collectionsAuthoringEnabled === true) {
    return formatOAuthScope(SCOPE_BY_INTENT.collections);
  }
  return formatOAuthScope(SCOPE_BY_INTENT.basic);
}

/**
 * Resolve scope without a known user (used when the user can't be looked up at
 * authorize time — e.g. handle resolution failed). Falls back to the basic
 * tier; the collections upgrade flow re-authorizes once the flag is set.
 */
export function resolveAuthScope(intent: AuthScopeIntent | undefined): string {
  return formatOAuthScope(SCOPE_BY_INTENT[intent ?? "basic"]);
}

/**
 * The collections-authoring collections — the records a reader can only write
 * with the collections tier granted. Mirrors `authCollections` plus the
 * `site.standard` publication/document collections granted by `authFull`.
 */
const COLLECTIONS_TIER_COLLECTIONS = [
  APP_NSID.collection,
  APP_NSID.collectionsPublication,
  APP_NSID.publicationTheme,
  STANDARD_NSID.publication,
  STANDARD_NSID.document,
] as const;

/**
 * Detect whether a granted-scope string (as snapshotted to `account.scope`
 * from `oauthSession.getTokenInfo().scope` on the OAuth callback) includes the
 * collections-authoring tier. This is the source of truth for "the reader has
 * actually accepted the collections scope" — as opposed to the
 * `user.collectionsAuthoringEnabled` flag, which is set optimistically in
 * `upgradeToCollections` *before* the re-auth completes and can be stale if the
 * PDS revoked consent or the re-auth failed.
 *
 * The PDS may grant either the `include:` set token (`include:app.standard-reader.authCollections` +
 * `include:site.standard.authFull`) or the expanded granular `repo?collection=...` tokens
 * (it expands sets on grant). This helper accepts both forms.
 */
export function hasCollectionsScope(
  grantedScope: string | null | undefined,
): boolean {
  if (!grantedScope) return false;
  const tokens = grantedScope.split(/\s+/);
  // Fast path: the include: set tokens are present verbatim.
  if (tokens.includes(AUTH_COLLECTIONS) && tokens.includes(SITE_AUTH_FULL)) {
    return true;
  }
  // Granular path: the PDS expanded the sets into repo?collection=... tokens.
  // A collections-tier grant covers every collections-authoring collection, so
  // require all of them to be present (a partial grant isn't the collections tier).
  return COLLECTIONS_TIER_COLLECTIONS.every((nsid) =>
    tokens.some((t) => parseRepoScopeCollections(t).has(nsid)),
  );
}

/**
 * Parse a single `repo?collection=A&collection=B` scope token into the set of
 * collection NSIDs it grants. Returns an empty set for non-repo tokens
 * (`atproto`, `blob?...`, `include:...`).
 */
function parseRepoScopeCollections(token: string): Set<string> {
  const q = token.indexOf("?");
  if (q === -1) return new Set();
  // Only `repo?...` tokens carry collections; `blob?...` doesn't.
  if (!token.startsWith("repo?")) return new Set();
  const params = token.slice(q + 1).split("&");
  const nsids = new Set<string>();
  for (const p of params) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    if (p.slice(0, eq) === "collection") {
      nsids.add(decodeURIComponent(p.slice(eq + 1)));
    }
  }
  return nsids;
}
