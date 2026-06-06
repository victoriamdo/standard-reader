import type * as DbSchema from "#/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Shared shapes + helpers for the read-model query layer (`APP_VISION.md` §5).
 *
 * The personal write path lives in `api-reader.functions.ts`; this module backs
 * the *read* queries (feeds, directory, profiles, articles, search). It defines
 * the serializable DTOs the UI consumes, the Drizzle column projections that
 * produce them, and the row→DTO mappers. Kept dependency-light (types + pure
 * mappers only — no server-only imports) so it can be referenced from anywhere.
 */

/** A JSON-serializable value (e.g. a document's raw `content` union object). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | Array<JsonValue>
  | { [key: string]: JsonValue };

/** The full schema module (matches `dbMiddleware`'s `context.schema`). */
export type Schema = typeof DbSchema;
/** The Drizzle client type (matches `dbMiddleware`'s `context.db`). */
export type Db = NodePgDatabase<Schema>;

/** A publication as rendered in cards, rails, and the directory. */
export interface PublicationCard {
  uri: string;
  did: string;
  name: string;
  url: string;
  description: string | null;
  iconUrl: string | null;
  topic: string | null;
  verified: boolean;
  subscriberCount: number;
  documentCount: number;
  lastDocumentAt: string | null;
}

/** An article (document) as rendered in feed rows, rails, and search results. */
export interface ArticleCard {
  uri: string;
  did: string;
  title: string;
  description: string | null;
  path: string | null;
  canonicalUrl: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
  featured: boolean;
  publicationUri: string | null;
  publicationName: string | null;
  publicationIconUrl: string | null;
}

/** A profile summary (byline / publication owner). */
export interface ProfileSummary {
  did: string;
  handle: string | null;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

// ── Drizzle column projections ──────────────────────────────────────────────

/**
 * Select-columns for a {@link PublicationCard}. Pulls the canonical record from
 * `publications` and the derived counts from `publication_stats`; queries should
 * `leftJoin` stats (a publication may not have a stats row yet).
 */
export function publicationCardColumns(schema: Schema) {
  const p = schema.publications;
  const st = schema.publicationStats;
  return {
    uri: p.uri,
    did: p.did,
    name: p.name,
    url: p.url,
    description: p.description,
    iconUrl: p.iconUrl,
    topic: p.topic,
    verified: p.verified,
    subscriberCount: st.subscriberCount,
    documentCount: st.documentCount,
    lastDocumentAt: st.lastDocumentAt,
  };
}

/**
 * Select-columns for an {@link ArticleCard}. Pulls the document plus its
 * publication's name/icon; queries should `leftJoin` publications on
 * `publications.uri = documents.publication_uri` (loose documents have none).
 */
export function articleCardColumns(schema: Schema) {
  const d = schema.documents;
  const p = schema.publications;
  return {
    uri: d.uri,
    did: d.did,
    title: d.title,
    description: d.description,
    path: d.path,
    canonicalUrl: d.canonicalUrl,
    coverImageUrl: d.coverImageUrl,
    publishedAt: d.publishedAt,
    featured: d.featured,
    publicationUri: d.publicationUri,
    publicationName: p.name,
    publicationIconUrl: p.iconUrl,
  };
}

// ── Row → DTO mappers ───────────────────────────────────────────────────────

type PublicationCardRow = {
  uri: string;
  did: string;
  name: string;
  url: string;
  description: string | null;
  iconUrl: string | null;
  topic: string | null;
  verified: boolean;
  subscriberCount: number | null;
  documentCount: number | null;
  lastDocumentAt: Date | null;
};

export function toPublicationCard(row: PublicationCardRow): PublicationCard {
  return {
    uri: row.uri,
    did: row.did,
    name: row.name,
    url: row.url,
    description: row.description,
    iconUrl: row.iconUrl,
    topic: row.topic,
    verified: row.verified,
    subscriberCount: row.subscriberCount ?? 0,
    documentCount: row.documentCount ?? 0,
    lastDocumentAt: row.lastDocumentAt?.toISOString() ?? null,
  };
}

type ArticleCardRow = {
  uri: string;
  did: string;
  title: string;
  description: string | null;
  path: string | null;
  canonicalUrl: string | null;
  coverImageUrl: string | null;
  publishedAt: Date;
  featured: boolean;
  publicationUri: string | null;
  publicationName: string | null;
  publicationIconUrl: string | null;
};

export function toArticleCard(row: ArticleCardRow): ArticleCard {
  return {
    uri: row.uri,
    did: row.did,
    title: row.title,
    description: row.description,
    path: row.path,
    canonicalUrl: row.canonicalUrl,
    coverImageUrl: row.coverImageUrl,
    publishedAt: row.publishedAt.toISOString(),
    featured: row.featured,
    publicationUri: row.publicationUri,
    publicationName: row.publicationName,
    publicationIconUrl: row.publicationIconUrl,
  };
}
