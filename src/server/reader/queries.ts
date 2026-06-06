/**
 * Shared read-model query helpers for the data layer (`APP_VISION.md` §5).
 *
 * These are pure functions over the Drizzle client + schema (threaded in from a
 * server fn's `dbMiddleware` context), so the same logic backs both the Home
 * rails and the Discover sections without duplicating SQL. The discovery
 * rankings here are deliberately simple reads over the precomputed aggregates
 * (`publication_stats`, `publication_cosubscriptions`); tuning their quality is
 * tracked separately under the discovery-engine work (TODO §7).
 */

import type {
  ArticleCard,
  Db,
  PublicationCard,
  Schema,
} from "#/integrations/tanstack-query/api-shapes";

import {
  articleCardColumns,
  publicationCardColumns,
  toArticleCard,
  toPublicationCard,
} from "#/integrations/tanstack-query/api-shapes";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";

export interface ArticleCardQuery {
  /** Restrict to documents in these publications (e.g. a reader's follows). */
  publicationUris?: Array<string>;
  /** When set, only documents this DID has NOT marked read (unread filter). */
  unreadForDid?: string;
  /** Only documents flagged featured (for the masthead lead). */
  featuredOnly?: boolean;
  /** Only documents that belong to a discover-eligible publication. */
  discoverOnly?: boolean;
  limit: number;
  offset?: number;
}

/**
 * Newest-first {@link ArticleCard}s, filtered to follows / unread / featured /
 * discover-eligible as requested. Returns `[]` when `publicationUris` is set but
 * empty (a reader with no follows), avoiding an `IN ()` that can never match.
 */
export async function selectArticleCards(
  db: Db,
  schema: Schema,
  opts: ArticleCardQuery,
): Promise<Array<ArticleCard>> {
  if (opts.publicationUris && opts.publicationUris.length === 0) {
    return [];
  }

  const d = schema.documents;
  const p = schema.publications;
  const pr = schema.profiles;
  const r = schema.reads;

  const conds = [eq(d.deleted, false)];
  if (opts.publicationUris) {
    conds.push(inArray(d.publicationUri, opts.publicationUris));
  }
  if (opts.featuredOnly) {
    conds.push(eq(d.featured, true));
  }
  if (opts.discoverOnly) {
    conds.push(isNotNull(d.publicationUri), eq(p.showInDiscover, true));
  }

  let query = db
    .select(articleCardColumns(schema))
    .from(d)
    .leftJoin(p, eq(p.uri, d.publicationUri))
    .leftJoin(pr, eq(pr.did, p.did))
    .$dynamic();

  if (opts.unreadForDid) {
    query = query.leftJoin(
      r,
      and(
        eq(r.documentUri, d.uri),
        eq(r.ownerDid, opts.unreadForDid),
        eq(r.deleted, false),
      ),
    );
    conds.push(isNull(r.uri));
  }

  const rows = await query
    .where(and(...conds))
    .orderBy(desc(d.publishedAt), desc(d.uri))
    .limit(opts.limit)
    .offset(opts.offset ?? 0);

  return rows.map((row) => toArticleCard(row));
}

/**
 * The reader's followed publications as {@link PublicationCard}s, alphabetical
 * by name — backs the sidebar "Following" list. Returns `[]` for readers with
 * no follows.
 */
export async function followedPublications(
  db: Db,
  schema: Schema,
  publicationUris: Array<string>,
): Promise<Array<PublicationCard>> {
  if (publicationUris.length === 0) {
    return [];
  }
  const p = schema.publications;
  const st = schema.publicationStats;
  const pr = schema.profiles;
  const rows = await db
    .select(publicationCardColumns(schema))
    .from(p)
    .leftJoin(st, eq(st.publicationUri, p.uri))
    .leftJoin(pr, eq(pr.did, p.did))
    .where(and(inArray(p.uri, publicationUris), eq(p.deleted, false)))
    .orderBy(p.name);
  return rows.map((row) => toPublicationCard(row));
}

/** Distinct publication AT-URIs a reader currently follows (active records). */
export async function selectFollowUris(
  db: Db,
  schema: Schema,
  did: string,
): Promise<Array<string>> {
  const sub = schema.subscriptions;
  const rows = await db
    .selectDistinct({ uri: sub.publicationUri })
    .from(sub)
    .where(and(eq(sub.subscriberDid, did), eq(sub.deleted, false)));
  return rows.map((row) => row.uri);
}

/** Count of unread documents across a reader's follows (for the Latest filter). */
export async function countFollowedDocuments(
  db: Db,
  schema: Schema,
  publicationUris: Array<string>,
  did: string,
): Promise<{ all: number; unread: number }> {
  if (publicationUris.length === 0) {
    return { all: 0, unread: 0 };
  }
  const d = schema.documents;
  const r = schema.reads;
  const [row] = await db
    .select({
      all: sql<number>`count(*)`.mapWith(Number),
      unread: sql<number>`count(*) filter (where ${r.uri} is null)`.mapWith(
        Number,
      ),
    })
    .from(d)
    .leftJoin(
      r,
      and(eq(r.documentUri, d.uri), eq(r.ownerDid, did), eq(r.deleted, false)),
    )
    .where(
      and(eq(d.deleted, false), inArray(d.publicationUri, publicationUris)),
    );

  return { all: row?.all ?? 0, unread: row?.unread ?? 0 };
}

// ── Discovery rails (reads over precomputed aggregates) ─────────────────────

/** Discover-eligible publications ranked by trending score (Trending rail). */
export async function trendingPublications(
  db: Db,
  schema: Schema,
  limit: number,
): Promise<Array<PublicationCard>> {
  const p = schema.publications;
  const st = schema.publicationStats;
  const pr = schema.profiles;
  const rows = await db
    .select(publicationCardColumns(schema))
    .from(st)
    .innerJoin(p, eq(p.uri, st.publicationUri))
    .leftJoin(pr, eq(pr.did, p.did))
    .where(and(eq(p.showInDiscover, true), eq(p.deleted, false)))
    .orderBy(desc(st.trendingScore))
    .limit(limit);
  return rows.map((row) => toPublicationCard(row));
}

/**
 * Most-subscribed discover-eligible publications (cold-start "popular"), with an
 * optional exclusion set (e.g. publications the reader already follows).
 */
export async function popularPublications(
  db: Db,
  schema: Schema,
  limit: number,
  excludeUris: Array<string> = [],
): Promise<Array<PublicationCard>> {
  const p = schema.publications;
  const st = schema.publicationStats;
  const pr = schema.profiles;

  const conds = [eq(p.showInDiscover, true), eq(p.deleted, false)];
  if (excludeUris.length > 0) {
    conds.push(notInArray(p.uri, excludeUris));
  }

  const rows = await db
    .select(publicationCardColumns(schema))
    .from(p)
    .leftJoin(st, eq(st.publicationUri, p.uri))
    .leftJoin(pr, eq(pr.did, p.did))
    .where(and(...conds))
    .orderBy(sql`coalesce(${st.subscriberCount}, 0) desc`)
    .limit(limit);
  return rows.map((row) => toPublicationCard(row));
}

/**
 * "Recommended for you" — collaborative filtering over the co-subscription
 * graph: publications co-followed by the readers of the ones you already follow,
 * scored by summed co-subscription similarity. Falls back to overall popularity
 * for cold-start readers (no follows / sparse graph).
 */
export async function recommendedPublications(
  db: Db,
  schema: Schema,
  did: string,
  limit: number,
): Promise<Array<PublicationCard>> {
  const followUris = await selectFollowUris(db, schema, did);
  if (followUris.length === 0) {
    return popularPublications(db, schema, limit);
  }

  const cs = schema.publicationCosubscriptions;
  const p = schema.publications;
  const st = schema.publicationStats;
  const pr = schema.profiles;

  const agg = db
    .select({
      relatedUri: cs.relatedPublicationUri,
      score: sql<number>`sum(${cs.score})`.as("score"),
    })
    .from(cs)
    .where(
      and(
        inArray(cs.publicationUri, followUris),
        notInArray(cs.relatedPublicationUri, followUris),
      ),
    )
    .groupBy(cs.relatedPublicationUri)
    .as("cosub_agg");

  const rows = await db
    .select(publicationCardColumns(schema))
    .from(agg)
    .innerJoin(p, eq(p.uri, agg.relatedUri))
    .leftJoin(st, eq(st.publicationUri, p.uri))
    .leftJoin(pr, eq(pr.did, p.did))
    .where(and(eq(p.showInDiscover, true), eq(p.deleted, false)))
    .orderBy(desc(agg.score))
    .limit(limit);

  if (rows.length === 0) {
    return popularPublications(db, schema, limit, followUris);
  }
  return rows.map((row) => toPublicationCard(row));
}

/**
 * "Readers also follow" for a publication profile — its top co-subscribed
 * publications by similarity score.
 */
export async function readersAlsoFollow(
  db: Db,
  schema: Schema,
  publicationUri: string,
  limit: number,
): Promise<Array<PublicationCard>> {
  const cs = schema.publicationCosubscriptions;
  const p = schema.publications;
  const st = schema.publicationStats;
  const pr = schema.profiles;

  const rows = await db
    .select(publicationCardColumns(schema))
    .from(cs)
    .innerJoin(p, eq(p.uri, cs.relatedPublicationUri))
    .leftJoin(st, eq(st.publicationUri, p.uri))
    .leftJoin(pr, eq(pr.did, p.did))
    .where(
      and(
        eq(cs.publicationUri, publicationUri),
        eq(p.showInDiscover, true),
        eq(p.deleted, false),
      ),
    )
    .orderBy(desc(cs.score))
    .limit(limit);
  return rows.map((row) => toPublicationCard(row));
}
