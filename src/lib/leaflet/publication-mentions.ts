import { STANDARD_NSID } from "#/lib/atproto/nsids";

/**
 * A Standard Reader publication resolved for an inline Leaflet reference — a
 * `pub.leaflet.richtext.facet#atMention` (by AT-URI) or a `#link` whose target
 * is a publication homepage. Rendered as an avatar chip linking to
 * `/p/$did/$rkey` instead of bare text or an off-site Leaflet link.
 */
export interface ResolvedPublicationMention {
  /** Publication AT-URI (`at://<did>/site.standard.publication/<rkey>`). */
  atUri: string;
  did: string;
  rkey: string;
  name: string;
  iconUrl: string | null;
}

/** Lookup keyed by publication AT-URI and by `url:<normalized-homepage>`. */
export type PublicationMentionMap = Record<string, ResolvedPublicationMention>;

const FACET_PREFIX = "pub.leaflet.richtext.facet#";

function facetKind($type: unknown): string | null {
  if (typeof $type !== "string" || !$type.startsWith(FACET_PREFIX)) return null;
  return $type.slice(FACET_PREFIX.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Leaflet's publication lexicon. Standard Reader mirrors each
 * `pub.leaflet.publication` to a `site.standard.publication` twin **at the same
 * rkey**, so a mention targeting either collection resolves to the same row.
 */
const LEAFLET_PUBLICATION_NSID = "pub.leaflet.publication";

const PUBLICATION_COLLECTIONS = new Set<string>([
  STANDARD_NSID.publication,
  LEAFLET_PUBLICATION_NSID,
]);

/**
 * If `atUri` targets a publication — via `site.standard.publication` or its
 * `pub.leaflet.publication` twin — return the canonical
 * `site.standard.publication` AT-URI used as the mention map key; else null.
 */
export function publicationMentionKey(atUri: string): string | null {
  if (!atUri.startsWith("at://")) return null;
  const parts = atUri.slice("at://".length).split("/");
  if (parts.length < 3) return null;
  const [did, collection, ...rest] = parts;
  const rkey = rest.join("/");
  if (!did || !collection || !rkey) return null;
  if (!PUBLICATION_COLLECTIONS.has(collection)) return null;
  return `at://${did}/${STANDARD_NSID.publication}/${rkey}`;
}

/**
 * Normalize a homepage URL to match the value stored in `publications.url`,
 * which is trailing-slash-stripped on ingest (see `normalizePublicationUrl`).
 * So a `#link` to `https://news.atproto.com.br/` matches the stored
 * `https://news.atproto.com.br`.
 */
export function normalizeMentionUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Map key for a publication homepage link. */
export function mentionUrlKey(url: string): string {
  return `url:${normalizeMentionUrl(url)}`;
}

/** An actor (user) resolved for an inline `#didMention` facet. */
export interface ResolvedActorMention {
  did: string;
  handle: string | null;
  avatarUrl: string | null;
}

/** Resolved actor mentions keyed by DID. */
export type ActorMentionMap = Record<string, ResolvedActorMention>;

/** The full set of inline references resolved for a document. */
export interface InlineMentions {
  publications: PublicationMentionMap;
  actors: ActorMentionMap;
}

export const EMPTY_INLINE_MENTIONS: InlineMentions = {
  publications: {},
  actors: {},
};

/** References an inline facet may point at, gathered from a document's content. */
export interface InlineMentionRefs {
  /** Canonical `site.standard.publication` AT-URIs from `#atMention` facets. */
  publicationAtUris: Array<string>;
  /** Homepage URLs from `#link` facets (candidate publications). */
  publicationUrls: Array<string>;
  /** Actor DIDs from `#didMention` / `#mention` facets. */
  actorDids: Array<string>;
}

/** True when there is at least one reference worth resolving. */
export function hasInlineMentionRefs(refs: InlineMentionRefs): boolean {
  return (
    refs.publicationAtUris.length > 0 ||
    refs.publicationUrls.length > 0 ||
    refs.actorDids.length > 0
  );
}

/**
 * Walk a Leaflet content/document payload for inline facet features worth
 * resolving: publication `#atMention`s (by AT-URI) and `#link`s (by homepage
 * URL), plus actor `#didMention`s. Structure-agnostic — recurses any object
 * carrying a `features` array, so it covers text, headings, blockquotes, and
 * nested list items alike.
 */
export function collectInlineMentionRefs(content: unknown): InlineMentionRefs {
  const publicationAtUris = new Set<string>();
  const publicationUrls = new Set<string>();
  const actorDids = new Set<string>();

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isRecord(node)) return;

    const features = node.features;
    if (Array.isArray(features)) {
      for (const feature of features) {
        if (!isRecord(feature)) continue;
        const kind = facetKind(feature.$type);
        if (kind === "atMention" && typeof feature.atURI === "string") {
          const key = publicationMentionKey(feature.atURI);
          if (key) publicationAtUris.add(key);
        } else if (kind === "link" && typeof feature.uri === "string") {
          publicationUrls.add(feature.uri);
        } else if (
          (kind === "didMention" || kind === "mention") &&
          typeof feature.did === "string"
        ) {
          actorDids.add(feature.did);
        }
      }
    }

    for (const key of Object.keys(node)) walk(node[key]);
  };

  walk(content);
  return {
    publicationAtUris: [...publicationAtUris],
    publicationUrls: [...publicationUrls],
    actorDids: [...actorDids],
  };
}

/** Actor a `#didMention` / `#mention` facet segment references, if resolved. */
export function lookupActorMention(
  features: ReadonlyArray<unknown>,
  actors: ActorMentionMap,
): ResolvedActorMention | null {
  for (const feature of features) {
    if (!isRecord(feature)) continue;
    const kind = facetKind(feature.$type);
    if (
      (kind === "didMention" || kind === "mention") &&
      typeof feature.did === "string"
    ) {
      const hit = actors[feature.did];
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Resolve the publication a facet segment references against a resolved map, if
 * any. Explicit `#atMention` targets win over homepage `#link`s.
 */
export function lookupPublicationMention(
  features: ReadonlyArray<unknown>,
  mentions: PublicationMentionMap,
): ResolvedPublicationMention | null {
  for (const feature of features) {
    if (!isRecord(feature)) continue;
    if (
      facetKind(feature.$type) === "atMention" &&
      typeof feature.atURI === "string"
    ) {
      const key = publicationMentionKey(feature.atURI);
      const hit = key ? mentions[key] : undefined;
      if (hit) return hit;
    }
  }
  for (const feature of features) {
    if (!isRecord(feature)) continue;
    if (
      facetKind(feature.$type) === "link" &&
      typeof feature.uri === "string"
    ) {
      const hit = mentions[mentionUrlKey(feature.uri)];
      if (hit) return hit;
    }
  }
  return null;
}
