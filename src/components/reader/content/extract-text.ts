import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";
import type { ArticleCard } from "#/integrations/tanstack-query/api-shapes";

import { leafletPlaintext } from "#/lib/leaflet/plaintext";
import { LEAFLET_CONTENT } from "#/lib/leaflet/types";

import { parseArticleBlocks } from "../article-content";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveContentType(article: ArticleDetail): string | null {
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
