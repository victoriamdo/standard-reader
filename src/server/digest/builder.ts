/**
 * Weekly-digest content builder. Pure data assembly (no rendering, no
 * transport) so it runs anywhere the read-model DB is reachable — the ingest
 * worker's send runner, a test, or a dev preview script.
 *
 * "Best of your follows" reuses {@link bestOfFollows} (trending-ranked, diversity
 * capped) and the unfollowed recommendations reuse {@link recommendedPublications}
 * (co-subscription / co-recommend blend, already excludes follows, cold-starts
 * to popular). Mirrors how `src/server/feeds/build.ts` composes cards.
 */

import type {
  ArticleCard,
  Db,
  PublicationCard,
  Schema,
} from "#/integrations/tanstack-query/api-shapes";
import {
  bestOfFollows,
  recommendedPublications,
  selectFollowUris,
} from "#/server/reader/queries";

import {
  DIGEST_ARTICLE_LIMIT,
  DIGEST_RECOMMENDATION_LIMIT,
  DIGEST_WINDOW_DAYS,
} from "./config";

export interface DigestData {
  /** Best-of articles from the reader's follows (empty ⇒ nothing to send). */
  articles: Array<ArticleCard>;
  /** Trending, not-yet-followed publications to recommend. */
  recommendations: Array<PublicationCard>;
}

/**
 * Assemble the digest for one reader. Returns `{ articles: [] }` when the
 * reader has no fresh best-of content this week — the caller should skip the
 * send entirely rather than mail an empty digest. Recommendations are only
 * fetched when there's a digest worth sending.
 */
export async function buildDigestForUser(
  db: Db,
  schema: Schema,
  { did }: { did: string },
): Promise<DigestData> {
  const followUris = await selectFollowUris(db, schema, did);

  const articles = await bestOfFollows(db, schema, {
    publicationUris: followUris,
    sinceDays: DIGEST_WINDOW_DAYS,
    limit: DIGEST_ARTICLE_LIMIT,
  });

  if (articles.length === 0) {
    return { articles: [], recommendations: [] };
  }

  const recommendations = await recommendedPublications(
    db,
    schema,
    did,
    DIGEST_RECOMMENDATION_LIMIT,
  );

  return { articles, recommendations };
}
