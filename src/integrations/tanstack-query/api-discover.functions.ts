import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAtprotoSessionForRequest } from "#/middleware/auth";
import { observe } from "#/server/observability/log";
import {
  followedByPeopleYouFollow,
  popularPublications,
  recommendedPublications,
  trendingPublicationUris,
  trendingPublications,
  withLivePublicationCounts,
} from "#/server/reader/queries";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { PublicationCard } from "./api-shapes";

import { publicationCardColumns, toPublicationCard } from "./api-shapes";
import { dbMiddleware } from "./db-middleware";

/**
 * Discover directory queries (`APP_VISION.md` §5): the topic chips, the full
 * "All publications" directory (topic filter + Readers/Active/A–Z sort +
 * pagination), and the Trending / Recommended rails. All reads come from the
 * Neon read-model + precomputed aggregates.
 */

const directorySort = z.enum(["readers", "active", "az"]);

const topicsInput = z.object({
  limit: z.number().int().min(1).max(20).default(8),
});

const directoryInput = z.object({
  topic: z.string().min(1).nullish(),
  sort: directorySort.default("readers"),
  limit: z.number().int().min(1).max(60).default(24),
  offset: z.number().int().min(0).default(0),
});

const railInput = z.object({
  limit: z.number().int().min(1).max(30).default(12),
});

export interface TopicChip {
  topic: string;
  count: number;
}

export interface PublicationDirectoryPage {
  items: Array<PublicationCard>;
  nextOffset: number | null;
}

const getTopics = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(topicsInput)
  .handler(
    observe("discover.getTopics", async ({ data, context }, span) => {
      const { db, schema } = context;
      const p = schema.publications;
      const rows = await db
        .select({
          topic: p.topic,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(p)
        .where(
          and(
            eq(p.showInDiscover, true),
            eq(p.deleted, false),
            isNotNull(p.topic),
          ),
        )
        .groupBy(p.topic)
        .orderBy(desc(sql`count(*)`))
        .limit(data.limit);

      span.set("count", rows.length);
      return rows
        .filter((row): row is { topic: string; count: number } =>
          Boolean(row.topic),
        )
        .map((row) => ({ topic: row.topic, count: row.count }));
    }),
  );

const getPublications = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(directoryInput)
  .handler(
    observe("discover.getPublications", async ({ data, context }, span) => {
      const { db, schema } = context;
      const p = schema.publications;
      const st = schema.publicationStats;
      const pr = schema.profiles;
      span.set("topic", data.topic ?? null);
      span.set("sort", data.sort);
      span.set("offset", data.offset);

      const conds = [eq(p.showInDiscover, true), eq(p.deleted, false)];
      if (data.topic) {
        conds.push(eq(p.topic, data.topic));
      }

      const orderBy =
        data.sort === "az"
          ? [asc(p.name)]
          : data.sort === "active"
            ? [sql`${st.lastDocumentAt} desc nulls last`, asc(p.name)]
            : [sql`coalesce(${st.subscriberCount}, 0) desc`, asc(p.name)];

      const rows = await db
        .select(publicationCardColumns(schema))
        .from(p)
        .leftJoin(st, eq(st.publicationUri, p.uri))
        .leftJoin(pr, eq(pr.did, p.did))
        .where(and(...conds))
        .orderBy(...orderBy)
        .limit(data.limit)
        .offset(data.offset);

      span.set("count", rows.length);
      return {
        items: rows.map((row) => toPublicationCard(row)),
        nextOffset:
          rows.length === data.limit ? data.offset + data.limit : null,
      } satisfies PublicationDirectoryPage;
    }),
  );

const getTrendingPublications = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(railInput)
  .handler(
    observe(
      "discover.getTrendingPublications",
      async ({ data, context }, span) => {
        const { db, schema } = context;
        const items = await trendingPublications(db, schema, data.limit);
        span.set("count", items.length);
        return items;
      },
    ),
  );

const getRecommendedPublications = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(railInput)
  .handler(
    observe(
      "discover.getRecommendedPublications",
      async ({ data, context }, span) => {
        const { db, schema } = context;
        const trendingExclude = await trendingPublicationUris(
          db,
          schema,
          data.limit,
        );
        span.set("trendingExclude", trendingExclude.length);

        const session = await getAtprotoSessionForRequest(getRequest());
        if (!session) {
          span.set("personalized", false);
          const items = await popularPublications(
            db,
            schema,
            data.limit,
            trendingExclude,
          );
          const withCounts = await withLivePublicationCounts(db, schema, items);
          span.set("count", withCounts.length);
          return withCounts.filter((pub) => pub.documentCount > 0);
        }
        span.set("did", session.did);
        span.set("personalized", true);
        const items = await recommendedPublications(
          db,
          schema,
          session.did,
          data.limit,
          { excludeUris: trendingExclude },
        );
        const withCounts = await withLivePublicationCounts(db, schema, items);
        span.set("count", withCounts.length);
        return withCounts.filter((pub) => pub.documentCount > 0);
      },
    ),
  );

const getFollowedByPeopleYouFollow = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(railInput)
  .handler(
    observe(
      "discover.getFollowedByPeopleYouFollow",
      async ({ data, context }, span) => {
        const { db, schema } = context;
        const session = await getAtprotoSessionForRequest(getRequest());
        if (!session) {
          span.set("count", 0);
          return [];
        }
        span.set("did", session.did);
        const trendingExclude = await trendingPublicationUris(
          db,
          schema,
          data.limit,
        );
        span.set("trendingExclude", trendingExclude.length);
        const items = await followedByPeopleYouFollow(
          db,
          schema,
          session.did,
          data.limit,
          { excludeUris: trendingExclude },
        );
        span.set("count", items.length);
        return withLivePublicationCounts(db, schema, items);
      },
    ),
  );

function getTopicsQueryOptions({ limit = 8 }: { limit?: number } = {}) {
  return queryOptions({
    queryKey: ["discover", "topics", limit] as const,
    queryFn: async () => getTopics({ data: { limit } }),
  });
}

function getPublicationsQueryOptions({
  topic = null,
  sort = "readers",
  limit = 24,
  offset = 0,
}: z.input<typeof directoryInput> = {}) {
  return queryOptions({
    queryKey: ["discover", "publications", topic, sort, limit, offset] as const,
    queryFn: async () =>
      getPublications({ data: { topic, sort, limit, offset } }),
  });
}

function getTrendingPublicationsQueryOptions({
  limit = 12,
}: { limit?: number } = {}) {
  return queryOptions({
    queryKey: ["discover", "trending", limit] as const,
    queryFn: async () => getTrendingPublications({ data: { limit } }),
  });
}

function getRecommendedPublicationsQueryOptions({
  limit = 12,
}: { limit?: number } = {}) {
  return queryOptions({
    queryKey: ["discover", "recommended", limit] as const,
    queryFn: async () => getRecommendedPublications({ data: { limit } }),
  });
}

function getFollowedByPeopleYouFollowQueryOptions({
  limit = 12,
}: { limit?: number } = {}) {
  return queryOptions({
    queryKey: ["discover", "followed-by", limit] as const,
    queryFn: async () => getFollowedByPeopleYouFollow({ data: { limit } }),
  });
}

export const discoverApi = {
  getTopics,
  getTopicsQueryOptions,
  getPublications,
  getPublicationsQueryOptions,
  getTrendingPublications,
  getTrendingPublicationsQueryOptions,
  getRecommendedPublications,
  getRecommendedPublicationsQueryOptions,
  getFollowedByPeopleYouFollow,
  getFollowedByPeopleYouFollowQueryOptions,
};
