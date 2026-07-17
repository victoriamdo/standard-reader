import {
  articleReaderUrl,
  collectionPieceReadUrl,
} from "#/components/reader/format";
/**
 * Weekly "hottest articles" Bluesky thread runner. Selects the top network
 * articles over the past week, composes a reply-chained thread of rich link
 * cards back to Standard Reader, and posts it as the reader bot — then exits.
 *
 * Invoked by the short-lived `thread-cron` job entrypoint
 * (`scripts/post-weekly-thread.ts`), deliberately in its own scheduled process
 * (not the `web` app or the long-lived `ingest` worker), mirroring `digest-cron`.
 *
 * Set `THREAD_DRY_RUN=1` to compose + log the thread without writing any records.
 */
import type { ArticleCard } from "#/integrations/tanstack-query/api-shapes";
import { getPublicUrl } from "#/lib/public-url";
import { topNetworkArticles } from "#/server/reader/queries";

import { db } from "../../db/index.ts";
import * as schema from "../../db/schema.ts";
import { loginAsReaderBot } from "./client.ts";
import {
  capGraphemes,
  HOT_ARTICLE_LIMIT,
  HOT_WINDOW_DAYS,
  isDryRun,
} from "./config.ts";
import { fetchThumbBlob, linkFacets, postThread } from "./thread.ts";
import type { PostSpec } from "./thread.ts";

export interface WeeklyThreadSummary {
  /** Hottest articles selected for the thread. */
  articles: number;
  /** Posts actually written to the PDS (0 on a dry run / empty week). */
  posted: number;
  /** AT-URI of the thread root, when posted. */
  rootUri: string | null;
  dryRun: boolean;
}

const CTA_APP_LABEL = "standard-reader.app";

/** Byline: publication name, else author display name, else @handle. */
function byline(card: ArticleCard): string | null {
  if (card.publicationName) return card.publicationName;
  if (card.authorDisplayName) return card.authorDisplayName;
  if (card.authorHandle) return `@${card.authorHandle}`;
  return null;
}

/** In-app reader when renderable, else the publication site, else the app. */
function articleUrl(card: ArticleCard, baseUrl: string): string {
  return (
    collectionPieceReadUrl(card, baseUrl) ??
    articleReaderUrl(card.uri, baseUrl) ??
    card.canonicalUrl ??
    baseUrl
  );
}

/** Compose one numbered article post (the first also carries the intro header). */
function articleSpec(
  card: ArticleCard,
  index: number,
  total: number,
  baseUrl: string,
  thumb?: Record<string, unknown> | null,
): PostSpec {
  const n = index + 1;
  const b = byline(card);
  const title = card.title.trim();
  const line = `${n}. ${title}${b ? ` — ${b}` : ""}`;
  const text =
    index === 0
      ? capGraphemes(
          `🔥 The ${total} hottest reads on Standard Reader this week\n\n${line}`,
        )
      : capGraphemes(line);
  return {
    text,
    external: {
      uri: articleUrl(card, baseUrl),
      title: capGraphemes(title, 300),
      description: card.description ?? "",
      ...(thumb ? { thumb } : {}),
    },
  };
}

/** Final call-to-action post with a tappable link to the app. */
function ctaSpec(baseUrl: string): PostSpec {
  const text = `Want a calmer home for reading on ATProto? Standard Reader lets you follow independent writers and publications and read them all in one clean feed.\n\nTry it → ${CTA_APP_LABEL}`;
  return { text, facets: linkFacets(text, CTA_APP_LABEL, baseUrl) };
}

export async function runWeeklyThread(): Promise<WeeklyThreadSummary> {
  const baseUrl = getPublicUrl();
  const dryRun = isDryRun();

  const cards = await topNetworkArticles(db, schema, {
    sinceDays: HOT_WINDOW_DAYS,
    limit: HOT_ARTICLE_LIMIT,
  });

  if (cards.length === 0) {
    console.info("[thread] no eligible articles this week — nothing to post");
    return { articles: 0, posted: 0, rootUri: null, dryRun };
  }

  if (dryRun) {
    const specs = cards.map((card, i) =>
      articleSpec(card, i, cards.length, baseUrl),
    );
    specs.push(ctaSpec(baseUrl));
    console.info(`[thread] DRY RUN — ${specs.length} posts composed:`);
    for (const [i, spec] of specs.entries()) {
      console.info(`\n--- post ${i + 1} ---\n${spec.text}`);
      if (spec.external) {
        console.info(`  [card] ${spec.external.title} → ${spec.external.uri}`);
      }
      if (spec.facets?.length) {
        console.info(`  [link] ${spec.facets[0].features[0].uri}`);
      }
    }
    for (const [i, card] of cards.entries()) {
      console.info(
        `  post ${i + 1} cover image: ${card.coverImageUrl ?? "none"}`,
      );
    }
    return { articles: cards.length, posted: 0, rootUri: null, dryRun: true };
  }

  const { client, repo, handle } = await loginAsReaderBot();
  console.info(`[thread] posting as @${handle} (${repo})`);

  const specs: Array<PostSpec> = [];
  for (let i = 0; i < cards.length; i++) {
    const thumb = await fetchThumbBlob(client, cards[i].coverImageUrl);
    specs.push(articleSpec(cards[i], i, cards.length, baseUrl, thumb));
  }
  specs.push(ctaSpec(baseUrl));

  const refs = await postThread(client, repo, specs);
  const rootUri = refs[0]?.uri ?? null;
  console.info(`[thread] posted ${refs.length} posts; root=${rootUri}`);
  return {
    articles: cards.length,
    posted: refs.length,
    rootUri,
    dryRun: false,
  };
}
