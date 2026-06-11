import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { observe } from "#/server/observability/log";
import { attachReaderSpanContext } from "#/server/observability/span-context.ts";
import { attachCommentCountsToArticles } from "#/server/reader/document-comments";
import {
  countTagArticles,
  countTagPublications,
  selectArticleCards,
  tagDirectoryPublications,
} from "#/server/reader/queries";
import { resolveTrackReadingHistoryEnabled } from "#/server/reader/track-reading-history";
import { z } from "zod";

import type { ArticleCard } from "./api-shapes";
import type { TagPublicationCard } from "#/server/reader/queries";

import { dbMiddleware } from "./db-middleware";

export type { TagPublicationCard };

const directorySort = z.enum(["tagged", "readers", "active", "az"]);

const tagInput = z.object({
  tag: z.string().trim().min(1).max(80),
});

const directoryInput = tagInput.extend({
  sort: directorySort.default("readers"),
  limit: z.number().int().min(1).max(60).default(24),
  offset: z.number().int().min(0).default(0),
});

export interface TagPublicationDirectoryPage {
  items: Array<TagPublicationCard>;
  nextOffset: number | null;
}

export interface TagArticleDirectoryPage {
  items: Array<ArticleCard>;
  nextOffset: number | null;
}

const articlesPageInput = tagInput.extend({
  limit: z.number().int().min(1).max(60).default(24),
  offset: z.number().int().min(0).default(0),
});

const getPublicationCount = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(tagInput)
  .handler(
    observe("tag.getPublicationCount", async ({ data, context }, span) => {
      await attachReaderSpanContext(span, getRequest());
      span.set("tag", data.tag);
      const count = await countTagPublications(
        context.db,
        context.schema,
        data.tag,
      );
      span.set("count", count);
      return count;
    }),
  );

const getArticleCount = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(tagInput)
  .handler(
    observe("tag.getArticleCount", async ({ data, context }, span) => {
      await attachReaderSpanContext(span, getRequest());
      span.set("tag", data.tag);
      const count = await countTagArticles(
        context.db,
        context.schema,
        data.tag,
      );
      span.set("count", count);
      return count;
    }),
  );

const getArticles = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(articlesPageInput)
  .handler(
    observe("tag.getArticles", async ({ data, context }, span) => {
      const { db, schema } = context;
      const did = await attachReaderSpanContext(span, getRequest());
      span.set("tag", data.tag);
      span.set("offset", data.offset);

      const trackReading =
        did == null
          ? false
          : await resolveTrackReadingHistoryEnabled(db, schema);

      const rows = await selectArticleCards(db, schema, {
        tag: data.tag,
        discoverOnly: true,
        limit: data.limit,
        offset: data.offset,
        readForDid: trackReading && did ? did : undefined,
      });

      const items = await attachCommentCountsToArticles(db, schema, rows);
      span.set("count", items.length);

      return {
        items,
        nextOffset:
          items.length === data.limit ? data.offset + data.limit : null,
      } satisfies TagArticleDirectoryPage;
    }),
  );

const getPublications = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(directoryInput)
  .handler(
    observe("tag.getPublications", async ({ data, context }, span) => {
      const { db, schema } = context;
      await attachReaderSpanContext(span, getRequest());
      span.set("tag", data.tag);
      span.set("sort", data.sort);
      span.set("offset", data.offset);

      const items = await tagDirectoryPublications(db, schema, {
        tag: data.tag,
        sort: data.sort,
        limit: data.limit,
        offset: data.offset,
      });

      span.set("count", items.length);
      return {
        items,
        nextOffset:
          items.length === data.limit ? data.offset + data.limit : null,
      } satisfies TagPublicationDirectoryPage;
    }),
  );

function getArticleCountQueryOptions({ tag }: z.input<typeof tagInput>) {
  return queryOptions({
    queryKey: ["tag", "articleCount", tag] as const,
    queryFn: async () => getArticleCount({ data: { tag } }),
  });
}

function getArticlesQueryOptions({
  tag,
  limit = 24,
  offset = 0,
}: z.input<typeof articlesPageInput>) {
  return queryOptions({
    queryKey: ["tag", "articles", tag, limit, offset] as const,
    queryFn: async () => getArticles({ data: { tag, limit, offset } }),
  });
}

function getPublicationCountQueryOptions({ tag }: z.input<typeof tagInput>) {
  return queryOptions({
    queryKey: ["tag", "publicationCount", tag] as const,
    queryFn: async () => getPublicationCount({ data: { tag } }),
  });
}

function getPublicationsQueryOptions({
  tag,
  sort = "readers",
  limit = 24,
  offset = 0,
}: z.input<typeof directoryInput>) {
  return queryOptions({
    queryKey: ["tag", "publications", tag, sort, limit, offset] as const,
    queryFn: async () =>
      getPublications({ data: { tag, sort, limit, offset } }),
  });
}

export const tagApi = {
  getArticleCount,
  getArticleCountQueryOptions,
  getArticles,
  getArticlesQueryOptions,
  getPublicationCount,
  getPublicationCountQueryOptions,
  getPublications,
  getPublicationsQueryOptions,
};
