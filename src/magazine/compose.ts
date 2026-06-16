import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";

import { parseArticleBlocks } from "#/lib/document/blocks";

import type { MagIssue, MagMeta } from "./types";

const WORDS_PER_MINUTE = 220;

function rkeyFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] ?? "";
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function readingMinutes(article: ArticleDetail): number {
  const text =
    article.textContent ??
    parseArticleBlocks({
      textContent: article.textContent,
      contentJson: article.contentJson,
    })
      .map((b) => b.text)
      .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function bylineAuthor(article: ArticleDetail): string {
  const contributor = article.contributors.find((c) => c.displayName?.trim());
  if (contributor?.displayName) return contributor.displayName;
  if (article.publicationOwnerDisplayName?.trim()) {
    return article.publicationOwnerDisplayName;
  }
  if (article.publicationOwnerHandle?.trim()) {
    return `@${article.publicationOwnerHandle}`;
  }
  return article.publication?.name ?? "Unknown";
}

export function articleMeta(article: ArticleDetail): MagMeta {
  return {
    id: article.uri,
    did: article.did,
    rkey: rkeyFromUri(article.uri),
    title: article.title || "Untitled",
    dek: article.description?.trim() || null,
    author: bylineAuthor(article),
    handle: article.publicationOwnerHandle,
    date: formatDate(article.publishedAt),
    minutes: readingMinutes(article),
    pubName: article.publication?.name ?? "Standard Reader",
    topic: article.publication?.topic ?? article.tags?.[0] ?? "Feature",
    coverImageUrl: article.coverImageUrl,
  };
}

export function composeIssue(
  name: string,
  ownerHandle: string | null,
  articles: Array<ArticleDetail>,
): MagIssue {
  return {
    name,
    no: "No. 1",
    sub: "app.standard-reader.list",
    ownerHandle,
    features: articles.map((detail) => ({ meta: articleMeta(detail), detail })),
  };
}
