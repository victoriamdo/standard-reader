import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  HOME_SCOPE_COOKIE,
  dbValueToHomeScope,
  parseHomeScope,
} from "#/lib/home-scope";
import {
  articleCardsAsAllRead,
  dbValueToTrackReadingHistory,
} from "#/lib/track-reading-history";
import { getReaderContextForRequest } from "#/middleware/auth-session.server";
import {
  attachSubscribedLabels,
  filterHiddenDocuments,
  hiddenDocumentUris,
} from "#/server/labeler/labels.server";
import type { Span } from "#/server/observability/log";
import { observe } from "#/server/observability/log";
import { attachReaderSpanContext } from "#/server/observability/span-context.ts";
import { attachCommentCountsToArticles } from "#/server/reader/document-comments";
import {
  countFollowedDocuments,
  countNetworkDocuments,
  countTrendingDocuments,
  popularPublications,
  recommendedPublications,
  selectArticleCards,
  trendingArticles,
  trendingPublicationUris,
} from "#/server/reader/queries";
import { effectiveFollowUris } from "#/server/reader/saved-lists";
import { loadSidebarData } from "#/server/reader/shell-snapshot.server";

import type { ArticleCard, Db, PublicationCard, Schema } from "./api-shapes";
import { dbMiddleware } from "./db-middleware";

/**
 * Feed queries (`APP_VISION.md` §5): the signed-in reader's Home (featured lead
 * + latest unread + Trending/You-might-follow rails) and Latest (chronological
 * Unread/Subscriptions/All-network with counts). Reads come from the Neon read-model; personal
 * unread-state is joined from the reader's own `reads`. Signed-out / cold-start
 * readers fall back to discover-eligible network content + popularity.
 */

const HOME_ROW_LIMIT = 8;
const HOME_RAIL_LIMIT = 6;
/** Full trending tab on Latest — home rail stays at {@link HOME_RAIL_LIMIT}. */
export const TRENDING_PAGE_LIMIT = 100;
const LATEST_PAGE_SIZE = 20;

const homeInput = z.object({
  /** `follows` — subscriptions (default); `network` — whole-network discover feed. */
  scope: z.enum(["follows", "network"]).default("follows"),
});

export type HomeScope = z.infer<typeof homeInput>["scope"];

const latestInput = z.object({
  /**
   * - `unread` — unread documents from the reader's subscriptions
   * - `subscriptions` — all documents from the reader's subscriptions
   * - `all` — the whole network (discover-eligible publications)
   * - `trending` — network-wide articles ranked by trending score
   */
  filter: z
    .enum(["unread", "subscriptions", "all", "trending"])
    .default("subscriptions"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(TRENDING_PAGE_LIMIT)
    .default(LATEST_PAGE_SIZE),
  offset: z.number().int().min(0).default(0),
});

export type LatestFilter = z.infer<typeof latestInput>["filter"];

export interface HomeFeed {
  /** Full-width featured lead (newest featured unread, else newest unread). */
  featured: ArticleCard | null;
  /** Latest unread rows from follows (excludes the featured lead). */
  latestUnread: Array<ArticleCard>;
  /** Trending articles rail (network-wide). */
  trending: Array<ArticleCard>;
  /** Recommended publications rail ("You might follow"). */
  youMightFollow: Array<PublicationCard>;
  /** True when tailored to the reader's follows (vs cold-start/signed-out). */
  personalized: boolean;
  /** True when the signed-in reader has at least one follow. */
  hasFollows: boolean;
  /**
   * Unread count across follows. `null` on the critical path — loaded lazily via
   * {@link getHomeExtras} so the first paint is not blocked on a count scan.
   */
  unreadCount: number | null;
}

/**
 * The deferred "You might follow" rail. Trending ships in the critical
 * {@link HomeFeed} payload (cheap, above the fold), so it's not here. Unread
 * masthead counts come from the sidebar snapshot (`getShellBootstrap` /
 * `getSidebar`), not this payload.
 */
export interface HomeFeedExtras {
  unreadCount: number | null;
  youMightFollow: Array<PublicationCard>;
}

export interface HomePageData {
  scope: HomeScope;
  /** Cache scope for personalized feed queries (`did` or `"guest"`). */
  readerScope: string;
  /**
   * Critical, above-the-fold payload: lead + latest rows + the Trending rail.
   * Only the below-the-fold "You might follow" rail is deferred (loaded via
   * {@link getHomeExtras} after first paint), so SSR never blocks on the
   * recommendation scans.
   */
  feed: HomeFeed;
}

const homePageInput = z.object({
  scope: z.enum(["follows", "network"]).optional(),
});

const homeExtrasInput = homeInput;

export interface LatestFeedCounts {
  /** Unread documents across the reader's subscriptions. */
  unread: number;
  /** All documents across the reader's subscriptions. */
  subscriptions: number;
  /** All discover-eligible documents across the network. */
  all: number;
  /** Articles in the trending candidate set. */
  trending: number;
}

export interface LatestFeed {
  items: Array<ArticleCard>;
  /**
   * Tab badges + masthead totals. `null` on the critical path — loaded lazily via
   * {@link getLatestFeedCounts} so the first paint is not blocked on count scans.
   */
  counts: LatestFeedCounts | null;
  /** Offset for the next page, or null when the last page was reached. */
  nextOffset: number | null;
}

export type FollowingPublication = PublicationCard & { unreadCount: number };

export interface SidebarData {
  /** Whether the reader is signed in (drives empty-state copy + auth chrome). */
  signedIn: boolean;
  /** Subscriptions or saved-list follows — mirrors home feed `personalized`. */
  hasFollows: boolean;
  /** Followed publications (most recent activity first) for the sidebar list. */
  following: Array<FollowingPublication>;
  /** Unread count across follows (null when signed out / no follows). */
  unreadCount: number | null;
  /** Saved-for-later count (null when signed out). */
  savedCount: number | null;
}

const getSidebar = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(
    observe("feed.getSidebar", async ({ context }, span) => {
      const { db, schema, trackReadingEnabled } = context;
      const did = await attachReaderSpanContext(span, getRequest());

      const trackReading = did ? trackReadingEnabled : false;
      if (did) {
        span.set("did", did);
        const followUris = await effectiveFollowUris(db, schema, did);
        span.set("follows", followUris.length);
      }

      return loadSidebarData(db, schema, did, trackReading);
    }),
  );

async function resolveHomeFeedContext(
  db: Db,
  schema: Schema,
  did: string | null | undefined,
  scope: HomeScope,
  span: Span,
  {
    trackReading: trackReadingOverride,
    trackReadingEnabled,
  }: { trackReading?: boolean; trackReadingEnabled?: boolean } = {},
) {
  const trackReading =
    trackReadingOverride ?? (did ? (trackReadingEnabled ?? false) : false);

  const followUris = did ? await effectiveFollowUris(db, schema, did) : [];
  const hasFollows = followUris.length > 0;
  const personalized = hasFollows && scope === "follows";
  span.set("follows", followUris.length);
  span.set("scope", scope);
  span.set("personalized", personalized);

  const rowQuery = personalized
    ? {
        publicationUris: followUris,
        ...(trackReading && did ? { readForDid: did, unreadForDid: did } : {}),
      }
    : { discoverOnly: true };

  return {
    did,
    followUris,
    trackReading,
    hasFollows,
    personalized,
    rowQuery,
  };
}

type HomeFeedContext = Awaited<ReturnType<typeof resolveHomeFeedContext>>;

async function buildHomeFeedCritical(
  db: Db,
  schema: Schema,
  ctx: HomeFeedContext,
  span: Span,
): Promise<HomeFeed> {
  const { trackReading, hasFollows, personalized, rowQuery } = ctx;

  const [featuredLead, rows] = await Promise.all([
    selectArticleCards(db, schema, {
      ...rowQuery,
      featuredOnly: true,
      limit: 1,
    }),
    selectArticleCards(db, schema, {
      ...rowQuery,
      limit: HOME_ROW_LIMIT + 1,
    }),
  ]);

  let featured: ArticleCard | null = featuredLead[0] ?? rows[0] ?? null;
  let latestUnread = rows
    .filter((row) => row.uri !== featured?.uri)
    .slice(0, HOME_ROW_LIMIT);

  if (!trackReading || !personalized) {
    featured = featured ? { ...featured, isRead: true } : null;
    latestUnread = articleCardsAsAllRead(latestUnread);
  }

  // Drop anything the reader hid via a subscribed labeler's label.
  const hidden = await hiddenDocumentUris(db, schema, ctx.did, [
    ...(featured ? [featured.uri] : []),
    ...latestUnread.map((article) => article.uri),
  ]);
  if (hidden.size > 0) {
    if (featured && hidden.has(featured.uri)) featured = null;
    latestUnread = latestUnread.filter((article) => !hidden.has(article.uri));
  }

  span.set("rows", latestUnread.length);

  const withCounts = await attachCommentCountsToArticles(db, schema, [
    ...(featured ? [featured] : []),
    ...latestUnread,
  ]);
  const enriched = await attachSubscribedLabels(
    db,
    schema,
    ctx.did,
    withCounts,
  );
  const byUri = new Map(enriched.map((article) => [article.uri, article]));

  // Trending rail lives above the fold, so it's part of the critical payload
  // (not deferred). The read is a cheap indexed top-N over `trending_score`
  // within the recency window — no recommendation scans — so blocking on it is
  // fine and avoids a loader flash. Exclude anything already shown as the lead
  // / latest rows.
  const excludeUris = [
    ...(featured ? [featured.uri] : []),
    ...latestUnread.map((article) => article.uri),
  ];
  const trendingRaw = await trendingArticles(db, schema, HOME_RAIL_LIMIT, {
    excludeUris,
  });
  const trendingVisible = await filterHiddenDocuments(
    db,
    schema,
    ctx.did,
    trendingRaw,
  );
  const trending = await attachCommentCountsToArticles(
    db,
    schema,
    trendingVisible.slice(0, HOME_RAIL_LIMIT),
  );
  span.set("trending", trending.length);

  return {
    featured: featured ? (byUri.get(featured.uri) ?? featured) : null,
    latestUnread: latestUnread.map(
      (article) => byUri.get(article.uri) ?? article,
    ),
    trending,
    youMightFollow: [],
    personalized,
    hasFollows,
    unreadCount: null,
  } satisfies HomeFeed;
}

/**
 * The deferred "You might follow" rail — the one expensive part of the home
 * page (co-subscription / co-recommend / co-reader-like blend). Below the fold,
 * so it's loaded after first paint via {@link getHomeExtras} rather than
 * blocking SSR. Trending is not here: it's cheap and above the fold, so it
 * ships in the critical {@link buildHomeFeedCritical} payload.
 */
async function buildHomeFeedExtras(
  db: Db,
  schema: Schema,
  ctx: HomeFeedContext,
  span: Span,
): Promise<HomeFeedExtras> {
  const { personalized, did, followUris } = ctx;

  const trendingPubUris = await trendingPublicationUris(
    db,
    schema,
    HOME_RAIL_LIMIT,
  );

  const youMightFollow =
    personalized && did
      ? await recommendedPublications(db, schema, did, HOME_RAIL_LIMIT, {
          excludeUris: trendingPubUris,
          followUris,
        })
      : await popularPublications(db, schema, HOME_RAIL_LIMIT, trendingPubUris);

  span.set("youMightFollow", youMightFollow.length);

  return {
    unreadCount: null,
    youMightFollow,
  } satisfies HomeFeedExtras;
}

async function loadHomeFeedCritical(
  db: Db,
  schema: Schema,
  did: string | null | undefined,
  scope: HomeScope,
  span: Span,
  options: { trackReading?: boolean; trackReadingEnabled?: boolean } = {},
): Promise<HomeFeed> {
  const ctx = await resolveHomeFeedContext(
    db,
    schema,
    did,
    scope,
    span,
    options,
  );
  return buildHomeFeedCritical(db, schema, ctx, span);
}

async function loadHomeFeedExtras(
  db: Db,
  schema: Schema,
  did: string | null | undefined,
  scope: HomeScope,
  span: Span,
  options: { trackReading?: boolean; trackReadingEnabled?: boolean } = {},
): Promise<HomeFeedExtras> {
  const ctx = await resolveHomeFeedContext(
    db,
    schema,
    did,
    scope,
    span,
    options,
  );
  return buildHomeFeedExtras(db, schema, ctx, span);
}

const getHomeFeed = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .validator(homeInput)
  .handler(
    observe("feed.getHomeFeed", async ({ data, context }, span) => {
      const { db, schema, trackReadingEnabled } = context;
      const did = await attachReaderSpanContext(span, getRequest());
      return loadHomeFeedCritical(db, schema, did, data.scope, span, {
        trackReadingEnabled,
      });
    }),
  );

/**
 * Scope preference + critical home feed in one round trip for the route loader.
 * The Trending / You-might-follow rails are below the fold and fetched
 * separately via {@link getHomeExtras} after first paint, so the SSR response
 * isn't blocked on the recommendation/trending scans.
 */
const getHomePage = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .validator(homePageInput)
  .handler(
    observe("feed.getHomePage", async ({ data, context }, span) => {
      const { db, schema } = context;
      const did = await attachReaderSpanContext(span, getRequest());
      const reader = did
        ? await getReaderContextForRequest(getRequest())
        : undefined;

      let scope: HomeScope;
      if (reader) {
        scope = data.scope ?? dbValueToHomeScope(reader.homeScope ?? null);
      } else {
        scope = data.scope ?? parseHomeScope(getCookie(HOME_SCOPE_COOKIE));
      }

      const trackReading =
        reader == null
          ? undefined
          : dbValueToTrackReadingHistory(reader.trackReadingHistory ?? null);

      const feed = await loadHomeFeedCritical(
        db,
        schema,
        did,
        scope,
        span,
        trackReading === undefined ? {} : { trackReading },
      );
      return {
        scope,
        readerScope: did ?? "guest",
        feed,
      } satisfies HomePageData;
    }),
  );

/** "You might follow" rail — loaded after the critical feed paints. */
const getHomeExtras = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .validator(homeExtrasInput)
  .handler(
    observe("feed.getHomeExtras", async ({ data, context }, span) => {
      const { db, schema, trackReadingEnabled } = context;
      const did = await attachReaderSpanContext(span, getRequest());

      return loadHomeFeedExtras(db, schema, did, data.scope, span, {
        trackReadingEnabled,
      });
    }),
  );

async function loadLatestFeedCritical(
  db: Db,
  schema: Schema,
  did: string | null | undefined,
  data: z.infer<typeof latestInput>,
  span: Span,
  trackReadingEnabled: boolean,
): Promise<LatestFeed> {
  span.set("filter", data.filter);
  span.set("offset", data.offset);

  const followUris = did ? await effectiveFollowUris(db, schema, did) : [];
  span.set("follows", followUris.length);
  const trackReading = did == null ? false : trackReadingEnabled;

  const trendingLimit =
    data.filter === "trending"
      ? Math.min(data.limit, TRENDING_PAGE_LIMIT - data.offset)
      : data.limit;

  const items =
    data.filter === "trending"
      ? trendingLimit > 0
        ? await trendingArticles(db, schema, trendingLimit, {
            offset: data.offset,
            readForDid: trackReading && did ? did : undefined,
            scope: "page",
          })
        : []
      : await selectArticleCards(db, schema, {
          ...(!did || data.filter === "all"
            ? { discoverOnly: true }
            : {
                publicationUris: followUris,
                unreadForDid:
                  trackReading && data.filter === "unread" ? did : undefined,
              }),
          readForDid: trackReading && did ? did : undefined,
          limit: data.limit,
          offset: data.offset,
        });

  span.set("count", items.length);
  // Hide labeled posts for the reader, but page on the pre-filter count so
  // pagination still advances (a page may just show slightly fewer rows).
  const visibleItems = await filterHiddenDocuments(db, schema, did, items);
  const enrichedItems = await attachCommentCountsToArticles(
    db,
    schema,
    trackReading ? visibleItems : articleCardsAsAllRead(visibleItems),
  );
  const labeledItems = await attachSubscribedLabels(
    db,
    schema,
    did,
    enrichedItems,
  );

  return {
    items: labeledItems,
    counts: null,
    nextOffset:
      data.filter === "trending"
        ? null
        : items.length === data.limit
          ? data.offset + data.limit
          : null,
  } satisfies LatestFeed;
}

async function loadLatestFeedCounts(
  db: Db,
  schema: Schema,
  did: string | null | undefined,
  span: Span,
  trackReadingEnabled: boolean,
): Promise<LatestFeedCounts> {
  const followUris = did ? await effectiveFollowUris(db, schema, did) : [];
  span.set("follows", followUris.length);
  const trackReading = did == null ? false : trackReadingEnabled;

  const [followCounts, networkCount, trendingCount] = await Promise.all([
    did
      ? countFollowedDocuments(db, schema, followUris, did)
      : Promise.resolve({ all: 0, unread: 0 }),
    countNetworkDocuments(db, schema),
    did ? countTrendingDocuments(db, schema, "page") : Promise.resolve(0),
  ]);

  return {
    unread: trackReading ? followCounts.unread : 0,
    subscriptions: followCounts.all,
    all: networkCount,
    trending: trendingCount,
  } satisfies LatestFeedCounts;
}

const getLatestFeed = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .validator(latestInput)
  .handler(
    observe("feed.getLatestFeed", async ({ data, context }, span) => {
      const { db, schema, trackReadingEnabled } = context;
      const did = await attachReaderSpanContext(span, getRequest());
      return loadLatestFeedCritical(
        db,
        schema,
        did,
        data,
        span,
        trackReadingEnabled,
      );
    }),
  );

/** Tab badges + masthead totals — loaded after the critical latest feed paints. */
const getLatestFeedCounts = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(
    observe("feed.getLatestFeedCounts", async ({ context }, span) => {
      const { db, schema, trackReadingEnabled } = context;
      const did = await attachReaderSpanContext(span, getRequest());
      return loadLatestFeedCounts(db, schema, did, span, trackReadingEnabled);
    }),
  );

function getLatestFeedCountsQueryOptions(readerScope = "guest") {
  return queryOptions({
    queryKey: ["feed", "latest", "counts", readerScope] as const,
    queryFn: async () => getLatestFeedCounts(),
    staleTime: 60_000,
  });
}

function getHomeFeedQueryOptions({
  scope = "follows",
  readerScope = "guest",
}: z.input<typeof homeInput> & { readerScope?: string } = {}) {
  return queryOptions({
    queryKey: ["feed", "home", scope, readerScope] as const,
    queryFn: async () => getHomeFeed({ data: { scope } }),
    staleTime: 60_000,
  });
}

function getHomeExtrasQueryOptions({
  scope = "follows",
  readerScope = "guest",
}: z.input<typeof homeExtrasInput> & { readerScope?: string } = {}) {
  return queryOptions({
    queryKey: ["feed", "home", "extras", scope, readerScope] as const,
    queryFn: async () => getHomeExtras({ data: { scope } }),
    staleTime: 60_000,
  });
}

export function latestFeedPageSize(filter: LatestFilter = "subscriptions") {
  return filter === "trending" ? TRENDING_PAGE_LIMIT : LATEST_PAGE_SIZE;
}

function getLatestFeedQueryOptions({
  filter = "subscriptions",
  limit = latestFeedPageSize(filter),
  offset = 0,
  readerScope = "guest",
}: z.input<typeof latestInput> & { readerScope?: string } = {}) {
  return queryOptions({
    queryKey: ["feed", "latest", filter, limit, offset, readerScope] as const,
    queryFn: async () => getLatestFeed({ data: { filter, limit, offset } }),
    staleTime: 60_000,
  });
}

function getSidebarQueryOptions() {
  return queryOptions({
    queryKey: ["feed", "sidebar"] as const,
    queryFn: async () => getSidebar(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export const feedApi = {
  getHomeFeed,
  getHomeFeedQueryOptions,
  getHomeExtras,
  getHomeExtrasQueryOptions,
  getHomePage,
  getLatestFeed,
  getLatestFeedCounts,
  getLatestFeedCountsQueryOptions,
  getLatestFeedQueryOptions,
  getSidebar,
  getSidebarQueryOptions,
};
