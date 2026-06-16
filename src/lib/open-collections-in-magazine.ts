/**
 * "Open collections in magazine" preference — when enabled, collection posts
 * link straight to the magazine edition instead of the reader view.
 *
 * Persisted as `magazine | reader` in the
 * `standard-reader-open-collections-in-magazine` cookie (SSR for everyone).
 * Signed-in users also store it on `user.open_collections_in_magazine`
 * (`null` = reader, the default; `true` = magazine).
 */

export const DEFAULT_OPEN_COLLECTIONS_IN_MAGAZINE = false;

export const OPEN_COLLECTIONS_IN_MAGAZINE_COOKIE =
  "standard-reader-open-collections-in-magazine";

export const OPEN_COLLECTIONS_IN_MAGAZINE_COOKIE_MAX_AGE_SECONDS =
  60 * 60 * 24 * 365;

export function parseOpenCollectionsInMagazineCookie(value: unknown): boolean {
  return value === "magazine";
}

export function openCollectionsInMagazineToCookieValue(
  enabled: boolean,
): "magazine" | "reader" {
  return enabled ? "magazine" : "reader";
}

export function openCollectionsInMagazineToDbValue(
  enabled: boolean,
): true | null {
  return enabled ? true : null;
}

export function dbValueToOpenCollectionsInMagazine(
  value: boolean | null | undefined,
): boolean {
  return value === true;
}

/** Reader route for a collection document — used when skipping reader on mag exit. */
export function collectionReaderPath(did: string, rkey: string): string {
  return `/a/${did}/${rkey}`;
}
