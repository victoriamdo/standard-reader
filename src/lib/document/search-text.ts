import type { JsonValue } from "#/integrations/tanstack-query/api-shapes";

import { markdownPlaintext } from "#/lib/document/structured-content/markdown";
import { STANDARD_MARKDOWN_CONTENT } from "#/lib/document/structured-content/types";
import { leafletPlaintext } from "#/lib/leaflet/plaintext";
import { LEAFLET_CONTENT } from "#/lib/leaflet/types";
import { offprintPlaintext } from "#/lib/offprint/plaintext";
import { OFFPRINT_CONTENT } from "#/lib/offprint/types";
import { pcktPlaintext } from "#/lib/pckt/plaintext";
import { PCKT_CONTENT } from "#/lib/pckt/types";

import { blocksPlaintext, parseArticleBlocks } from "./blocks";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveContentFormat(
  contentFormat: string | null | undefined,
  contentJson: JsonValue | unknown,
): string | null {
  if (contentFormat) return contentFormat;
  if (isRecord(contentJson) && typeof contentJson.$type === "string") {
    return contentJson.$type;
  }
  return null;
}

/** Collapse all whitespace runs so formatting differences don't defeat dedupe. */
function normalizeForCompare(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

/**
 * Append `next` unless it's already represented. Containment (not equality) on
 * whitespace-normalized text: the record `textContent` and the plaintext
 * extracted from structured blocks are usually the same body with different
 * paragraph joins, and equality-only dedupe used to store the article twice —
 * and made re-running the backfill append another copy every run.
 */
function appendUniquePart(parts: Array<string>, next: string | null) {
  const trimmed = next?.trim();
  if (!trimmed) return;
  const normalized = normalizeForCompare(trimmed);
  if (!normalized) return;
  const kept: Array<string> = [];
  for (const part of parts) {
    const partNormalized = normalizeForCompare(part);
    // An existing part already covers the new one — nothing to add.
    if (partNormalized.includes(normalized)) return;
    // The new part supersedes this existing one — drop it.
    if (normalized.includes(partNormalized)) continue;
    kept.push(part);
  }
  parts.length = 0;
  parts.push(...kept, trimmed);
}

/** Plaintext extracted from structured `content` blocks only (no record text). */
export function documentExtractedText(
  contentJson: JsonValue | unknown,
  contentFormat?: string | null,
): string | null {
  const format = resolveContentFormat(contentFormat, contentJson);
  if (format === LEAFLET_CONTENT) {
    return leafletPlaintext(contentJson);
  }
  if (format === PCKT_CONTENT) {
    return pcktPlaintext(contentJson);
  }
  if (format === OFFPRINT_CONTENT) {
    return offprintPlaintext(contentJson);
  }
  if (format === STANDARD_MARKDOWN_CONTENT) {
    return markdownPlaintext(contentJson);
  }
  return blocksPlaintext(
    parseArticleBlocks({
      textContent: null,
      contentJson: contentJson as JsonValue,
    }),
  );
}

/**
 * Best-effort searchable body text: record `textContent` plus any plaintext
 * extracted from structured `content` blocks (leaflet pages, JSON blocks, etc.).
 */
export function documentSearchText({
  textContent,
  contentJson,
  contentFormat,
}: {
  textContent?: string | null;
  contentJson: JsonValue | unknown;
  contentFormat?: string | null;
}): string | null {
  const parts: Array<string> = [];
  appendUniquePart(parts, textContent ?? null);
  appendUniquePart(parts, documentExtractedText(contentJson, contentFormat));

  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

/**
 * Recover a usable base text from a stored search blob that may contain
 * compounded copies of the extracted block plaintext. Earlier versions of the
 * search-text backfill fed the stored blob back in as `textContent` while the
 * dedupe matched on exact equality only, so every run appended another copy of
 * the extracted text (`record text + extracted × n`).
 *
 * Strips exact repeated `extracted` copies off the end, and if the remainder
 * still contains the extracted text more than once (copies from older extractor
 * versions we can't match exactly), falls back to the extracted text alone —
 * it covers the whole article body, which is what search needs.
 */
export function repairCompoundedSearchText(
  stored: string,
  extracted: string | null,
): string {
  const extractedTrimmed = extracted?.trim();
  if (!extractedTrimmed) return stored;

  let base = stored;
  const suffix = `\n\n${extractedTrimmed}`;
  while (base.endsWith(suffix)) base = base.slice(0, -suffix.length);
  if (base === extractedTrimmed) return base;

  const haystack = normalizeForCompare(base);
  const needle = normalizeForCompare(extractedTrimmed);
  if (!needle) return base;
  let occurrences = 0;
  let from = 0;
  while (occurrences < 2) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    occurrences += 1;
    from = index + needle.length;
  }
  return occurrences >= 2 ? extractedTrimmed : base;
}
