import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * `site.standard.graph.subscription` records — the subscription graph (these are
 * standard.site subscriptions, NOT Bluesky follows). A subscription means the
 * repo owner (`subscriberDid`) subscribes to a publication.
 *
 * Keyed by the record AT-URI. Required lexicon field: `publication` (at-uri).
 * This graph powers social proof, "followed by people you follow", and the
 * co-subscription recommendations.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    /** AT-URI of the subscription record. */
    uri: text("uri").primaryKey(),
    cid: text("cid"),
    /** DID of the subscriber (the repo that holds this record). */
    subscriberDid: text("subscriber_did").notNull(),
    rkey: text("rkey").notNull(),

    /** AT-URI of the subscribed-to publication record (required). */
    publicationUri: text("publication_uri").notNull(),
    /** DID extracted from `publicationUri` (useful before the publication
     * record itself has been indexed). */
    publicationDid: text("publication_did"),

    /** `createdAt` from the record (optional in the lexicon). */
    createdAt: timestamp("created_at", { withTimezone: true }),

    deleted: boolean("deleted").notNull().default(false),

    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Subscriber count + "readers also follow" fan-out from a publication.
    index("subscriptions_publication_idx").on(table.publicationUri),
    // A given user's subscription list (sidebar / feed).
    index("subscriptions_subscriber_idx").on(table.subscriberDid),
    // Look up the edge (a subscriber→publication pair). NOT unique: a repo can
    // legitimately hold multiple subscription records for the same pair, and
    // each record is uniquely keyed by `uri`. Counts use DISTINCT subscriber.
    index("subscriptions_edge_idx").on(
      table.subscriberDid,
      table.publicationUri,
    ),
  ],
);

/**
 * `site.standard.graph.recommend` records — per-document endorsements. A
 * lightweight signal that feeds trending and recommendations.
 *
 * Keyed by the record AT-URI. Required lexicon fields: `document`, `createdAt`.
 */
export const recommends = pgTable(
  "recommends",
  {
    /** AT-URI of the recommend record. */
    uri: text("uri").primaryKey(),
    cid: text("cid"),
    /** DID of the recommender (the repo that holds this record). */
    recommenderDid: text("recommender_did").notNull(),
    rkey: text("rkey").notNull(),

    /** AT-URI of the recommended document (required). */
    documentUri: text("document_uri").notNull(),
    /** DID extracted from `documentUri`. */
    documentDid: text("document_did"),

    /** `createdAt` from the record (required in the lexicon). */
    createdAt: timestamp("created_at", { withTimezone: true }),

    deleted: boolean("deleted").notNull().default(false),

    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("recommends_document_idx").on(table.documentUri),
    index("recommends_recommender_idx").on(table.recommenderDid),
    // NOT unique — see subscriptions_edge_idx. Each record keyed by `uri`.
    index("recommends_edge_idx").on(table.recommenderDid, table.documentUri),
  ],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Recommend = typeof recommends.$inferSelect;
export type NewRecommend = typeof recommends.$inferInsert;
