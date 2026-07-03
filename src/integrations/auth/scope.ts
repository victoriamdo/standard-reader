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
 * ATStore's docs refer to an `authReviewer` bundle, but the published least-
 * privilege permission set currently discoverable for third-party review
 * submission is `authThirdPartyReviews`.
 */
export const ATSTORE_REVIEW_SCOPE = "include:fyi.atstore.authThirdPartyReviews";

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

/**
 * Separate client-metadata scope for the ATStore review progressive-auth flow.
 * This keeps the default login client metadata unchanged while still letting a
 * dedicated review-only OAuth client request the extra ATStore reviewer scope.
 */
export const atstoreReviewClientMetadataScope = [
  ...new Set([...clientMetadataScope, ATSTORE_REVIEW_SCOPE]),
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
 * Parse repo scope tokens into the set of collection NSIDs they grant.
 *
 * ATProto scope strings appear in two shapes in the wild:
 * - `repo?collection=A&collection=B&action=create`
 * - `repo:A?action=create`
 *
 * Accept both here so granted-scope checks keep working regardless of which
 * serialization the auth server returns in `tokenInfo.scope`.
 */
function parseRepoScopeCollections(token: string): Set<string> {
  const q = token.indexOf("?");
  const nsids = new Set<string>();

  if (token.startsWith("repo:")) {
    const collection = token.slice("repo:".length, q === -1 ? undefined : q);
    if (collection) {
      nsids.add(decodeURIComponent(collection));
    }
    return nsids;
  }

  if (q === -1) return nsids;
  if (!token.startsWith("repo?")) return nsids;

  const params = token.slice(q + 1).split("&");
  for (const p of params) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    if (p.slice(0, eq) === "collection") {
      nsids.add(decodeURIComponent(p.slice(eq + 1)));
    }
  }
  return nsids;
}

function parseRepoScopeActions(token: string): Set<string> {
  const q = token.indexOf("?");
  if (q === -1) return new Set();
  if (!token.startsWith("repo?") && !token.startsWith("repo:")) {
    return new Set();
  }
  const params = token.slice(q + 1).split("&");
  const actions = new Set<string>();
  for (const p of params) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    if (p.slice(0, eq) === "action") {
      actions.add(decodeURIComponent(p.slice(eq + 1)));
    }
  }
  return actions;
}

function repoScopeAllowsCreateForCollection(
  token: string,
  collection: string,
): boolean {
  const collections = parseRepoScopeCollections(token);
  if (!collections.has(collection)) return false;
  const actions = parseRepoScopeActions(token);
  return actions.size === 0 || actions.has("create");
}

/**
 * Detect whether the granted scope includes the ATStore review writer tier.
 * Accept the published third-party review set, the broader ATStore basic set,
 * the docs alias (`authReviewer`), or the PDS-expanded granular repo scopes.
 */
export function hasAtstoreReviewScope(
  grantedScope: string | null | undefined,
): boolean {
  if (!grantedScope) return false;
  const tokens = grantedScope.split(/\s+/);
  if (
    tokens.includes("include:fyi.atstore.authThirdPartyReviews") ||
    tokens.includes("include:fyi.atstore.authBasic") ||
    tokens.includes("include:fyi.atstore.authReviewer")
  ) {
    return true;
  }
  return (
    tokens.some((token) =>
      repoScopeAllowsCreateForCollection(token, "fyi.atstore.profile"),
    ) &&
    tokens.some((token) =>
      repoScopeAllowsCreateForCollection(token, "fyi.atstore.listing.review"),
    )
  );
}
