import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";
import type { ArticleCard } from "#/integrations/tanstack-query/api-shapes";

import { parseArticleBlocks } from "#/lib/document/blocks";
import { markdownPlaintext } from "#/lib/document/structured-content/markdown";
import { STANDARD_MARKDOWN_CONTENT } from "#/lib/document/structured-content/types";
import { leafletPlaintext } from "#/lib/leaflet/plaintext";
import { LEAFLET_CONTENT } from "#/lib/leaflet/types";
import { offprintPlaintext } from "#/lib/offprint/plaintext";
import { OFFPRINT_CONTENT } from "#/lib/offprint/types";
import { pcktPlaintext } from "#/lib/pckt/plaintext";
import { PCKT_CONTENT } from "#/lib/pckt/types";

// Re-exported so existing reader-UI imports keep working; the implementation
// lives in `#/lib/document/renderable` so it can run at ingest/backfill time.
export { hasRenderableArticleBody } from "#/lib/document/renderable";

type ArticleBodyFields = Pick<
  ArticleDetail,
  "textContent" | "contentJson" | "contentFormat"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveContentType(article: ArticleBodyFields): string | null {
  if (article.contentFormat) return article.contentFormat;
  if (
    isRecord(article.contentJson) &&
    typeof article.contentJson.$type === "string"
  ) {
    return article.contentJson.$type;
  }
  return null;
}

/** Best-effort full text for reading-time estimates and search previews. */
export function articleReadingText(article: ArticleDetail): string | null {
  if (article.textContent?.trim()) return article.textContent;

  const contentType = resolveContentType(article);
  if (contentType === LEAFLET_CONTENT) {
    return leafletPlaintext(article.contentJson);
  }
  if (contentType === PCKT_CONTENT) {
    return pcktPlaintext(article.contentJson);
  }
  if (contentType === OFFPRINT_CONTENT) {
    return offprintPlaintext(article.contentJson);
  }
  if (contentType === STANDARD_MARKDOWN_CONTENT) {
    return markdownPlaintext(article.contentJson);
  }

  const blocks = parseArticleBlocks({
    textContent: article.textContent,
    contentJson: article.contentJson,
  });
  if (blocks.length > 0) {
    return blocks.map((block) => block.text).join("\n\n");
  }

  return article.description;
}

/** Reading-time input for feed cards (full body when indexed, else dek). */
export function articleCardReadingText(
  article: Pick<ArticleCard, "textContent" | "description">,
): string | null {
  if (article.textContent?.trim()) return article.textContent;
  return article.description;
}
