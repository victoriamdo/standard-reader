import {
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { publications } from "./publications.ts";

/**
 * Derived per-publication aggregates (1:1 with `publications`). Kept separate
 * from the canonical record so a recompute pass can rewrite these cheaply
 * without touching the source-of-truth columns.
 *
 * Drives directory sort (Readers / Active / A–Z), trending, and freshness.
 */
export const publicationStats = pgTable(
  "publication_stats",
  {
    publicationUri: text("publication_uri")
      .primaryKey()
      .references(() => publications.uri, { onDelete: "cascade" }),

    /** Lifetime totals. */
    subscriberCount: integer("subscriber_count").notNull().default(0),
    documentCount: integer("document_count").notNull().default(0),
    /** Sum of recommends across this publication's documents. */
    recommendCount: integer("recommend_count").notNull().default(0),

    /** Freshness: newest document publish time (for the "Active" sort). */
    lastDocumentAt: timestamp("last_document_at", { withTimezone: true }),

    /** Rolling-window activity (window length is tunable). */
    documents7d: integer("documents_7d").notNull().default(0),
    subscribers7d: integer("subscribers_7d").notNull().default(0),
    recommends7d: integer("recommends_7d").notNull().default(0),

    /** Computed ranking score for trending (new docs + follow velocity). */
    trendingScore: doublePrecision("trending_score").notNull().default(0),
    /** Start of the window the rolling counts were computed over. */
    trendingWindowStart: timestamp("trending_window_start", {
      withTimezone: true,
    }),

    recomputedAt: timestamp("recomputed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Directory sort: Readers.
    index("publication_stats_subscribers_idx").on(table.subscriberCount.desc()),
    // Directory sort: Active (most recent document).
    index("publication_stats_active_idx").on(table.lastDocumentAt.desc()),
    // Trending rail.
    index("publication_stats_trending_idx").on(table.trendingScore.desc()),
  ],
);

/**
 * Materialized co-subscription graph for "Recommended for you" (collaborative
 * filtering): publications frequently subscribed to alongside a given one.
 * Recomputed periodically from the subscription edges.
 */
export const publicationCosubscriptions = pgTable(
  "publication_cosubscriptions",
  {
    /** The anchor publication. */
    publicationUri: text("publication_uri")
      .notNull()
      .references(() => publications.uri, { onDelete: "cascade" }),
    /** A publication co-subscribed by the anchor's subscribers. */
    relatedPublicationUri: text("related_publication_uri")
      .notNull()
      .references(() => publications.uri, { onDelete: "cascade" }),
    /** Number of subscribers shared by both publications. */
    coSubscriberCount: integer("co_subscriber_count").notNull().default(0),
    /** Normalized similarity score (e.g. cosine / Jaccard). */
    score: doublePrecision("score").notNull().default(0),
    recomputedAt: timestamp("recomputed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.publicationUri, table.relatedPublicationUri],
    }),
    // Top-N related publications for a given anchor.
    index("publication_cosub_rank_idx").on(
      table.publicationUri,
      table.score.desc(),
    ),
  ],
);

export type PublicationStats = typeof publicationStats.$inferSelect;
export type NewPublicationStats = typeof publicationStats.$inferInsert;
export type PublicationCosubscription =
  typeof publicationCosubscriptions.$inferSelect;
export type NewPublicationCosubscription =
  typeof publicationCosubscriptions.$inferInsert;
