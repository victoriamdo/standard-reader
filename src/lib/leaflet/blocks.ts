import type {
  LeafletBlockquoteBlock,
  LeafletBskyPostBlock,
  LeafletCodeBlock,
  LeafletContent,
  LeafletHeaderBlock,
  LeafletIframeBlock,
  LeafletImageBlock,
  LeafletOrderedListBlock,
  LeafletRenderableBlock,
  LeafletTextBlock,
  LeafletUnorderedListBlock,
  LeafletWebsiteBlock,
} from "./types";

import { LEAFLET_BLOCK, LEAFLET_CONTENT, LEAFLET_PAGE } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapPageBlock(entry: unknown): Record<string, unknown> | null {
  if (!isRecord(entry)) return null;
  if (entry.$type === LEAFLET_PAGE.linearDocumentBlock) {
    const inner = entry.block;
    return isRecord(inner) ? inner : null;
  }
  // Skyreader linkblogs nest blocks under `block` without the page wrapper $type.
  const nested = entry.block;
  if (isRecord(nested) && typeof nested.$type === "string") {
    return nested;
  }
  return entry;
}

export function asTextBlock(value: unknown): LeafletTextBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.text) return null;
  if (typeof value.plaintext !== "string") return null;
  return value as unknown as LeafletTextBlock;
}

function asHeaderBlock(value: unknown): LeafletHeaderBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.header) return null;
  if (typeof value.plaintext !== "string") return null;
  return value as unknown as LeafletHeaderBlock;
}

function asBlockquoteBlock(value: unknown): LeafletBlockquoteBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.blockquote) return null;
  if (typeof value.plaintext !== "string") return null;
  return value as unknown as LeafletBlockquoteBlock;
}

function asUnorderedListBlock(
  value: unknown,
): LeafletUnorderedListBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.unorderedList) return null;
  return value as unknown as LeafletUnorderedListBlock;
}

function asOrderedListBlock(value: unknown): LeafletOrderedListBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.orderedList) return null;
  return value as unknown as LeafletOrderedListBlock;
}

function asCodeBlock(value: unknown): LeafletCodeBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.code) return null;
  if (typeof value.plaintext !== "string") return null;
  return value as unknown as LeafletCodeBlock;
}

function asIframeBlock(value: unknown): LeafletIframeBlock | null {
  if (!isRecord(value)) return null;
  if (value.$type !== LEAFLET_BLOCK.iframe) return null;
  return value as unknown as LeafletIframeBlock;
}

function asRenderableBlock(value: unknown): LeafletRenderableBlock | null {
  if (!isRecord(value)) return null;

  const text = asTextBlock(value);
  if (text) return { kind: "text", block: text };

  const header = asHeaderBlock(value);
  if (header) return { kind: "header", block: header };

  const blockquote = asBlockquoteBlock(value);
  if (blockquote) return { kind: "blockquote", block: blockquote };

  const unorderedList = asUnorderedListBlock(value);
  if (unorderedList) return { kind: "unorderedList", block: unorderedList };

  const orderedList = asOrderedListBlock(value);
  if (orderedList) return { kind: "orderedList", block: orderedList };

  if (value.$type === LEAFLET_BLOCK.bskyPost) {
    return {
      kind: "bskyPost",
      block: value as unknown as LeafletBskyPostBlock,
    };
  }

  if (value.$type === LEAFLET_BLOCK.image) {
    return {
      kind: "image",
      block: value as unknown as LeafletImageBlock,
    };
  }

  const code = asCodeBlock(value);
  if (code) return { kind: "code", block: code };

  const iframe = asIframeBlock(value);
  if (iframe) return { kind: "iframe", block: iframe };

  if (value.$type === LEAFLET_BLOCK.website) {
    const url = typeof value.url === "string" ? value.url : null;
    if (!url) return null;
    return {
      kind: "website",
      block: value as unknown as LeafletWebsiteBlock,
    };
  }

  if (value.$type === LEAFLET_BLOCK.horizontalRule) {
    return { kind: "horizontalRule" };
  }

  const blockType =
    typeof value.$type === "string" ? value.$type : "unknown block";
  return { kind: "unknown", blockType };
}

function blocksFromPage(page: unknown): Array<LeafletRenderableBlock> {
  if (!isRecord(page)) return [];
  const blocks = page.blocks;
  if (!Array.isArray(blocks)) return [];

  const result: Array<LeafletRenderableBlock> = [];
  for (const entry of blocks) {
    const inner = unwrapPageBlock(entry);
    if (!inner) continue;
    const parsed = asRenderableBlock(inner);
    if (parsed) result.push(parsed);
  }
  return result;
}

/** Every renderable block in document order. */
export function leafletBlocks(content: unknown): Array<LeafletRenderableBlock> {
  if (!isRecord(content)) return [];
  if (content.$type !== LEAFLET_CONTENT) return [];
  const pages = content.pages;
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => blocksFromPage(page));
}

/** AT-URIs of every embedded Bluesky post block, in document order. */
export function leafletBskyPostUris(content: unknown): Array<string> {
  return leafletBlocks(content)
    .map((block) =>
      block.kind === "bskyPost" ? block.block.postRef?.uri : undefined,
    )
    .filter((uri): uri is string => typeof uri === "string" && uri.length > 0);
}

/**
 * Plaintext lines contributed by a single leaflet block (for reading-time
 * ingest). `bskyPostText` optionally supplies narration text for embedded
 * Bluesky posts (keyed by their AT-URI) so the page reader can speak them.
 */
export function plaintextLinesFromBlock(
  block: LeafletRenderableBlock,
  bskyPostText?: Map<string, string>,
): Array<string> {
  switch (block.kind) {
    case "text": {
      const text = block.block.plaintext.trim();
      return text ? [text] : [];
    }
    case "header": {
      const text = block.block.plaintext.trim();
      return text ? [text] : [];
    }
    case "blockquote": {
      const text = block.block.plaintext.trim();
      return text ? [text] : [];
    }
    case "unorderedList":
    case "orderedList": {
      const children = block.block.children ?? [];
      const lines: Array<string> = [];
      for (const child of children) {
        const item = asTextBlock(child.content);
        if (item?.plaintext.trim()) lines.push(item.plaintext.trim());
      }
      return lines;
    }
    case "code": {
      const text = block.block.plaintext.trim();
      return text ? [text] : [];
    }
    case "bskyPost": {
      const uri = block.block.postRef?.uri;
      const text = uri ? bskyPostText?.get(uri) : undefined;
      return text ? [text] : [];
    }
    case "website": {
      const title = block.block.title?.trim();
      const description = block.block.description?.trim();
      const lines: Array<string> = [];
      if (title) lines.push(title);
      if (description) lines.push(description);
      return lines;
    }
    case "horizontalRule":
    case "image":
    case "iframe":
    case "unknown": {
      return [];
    }
  }
}

export function asLeafletContent(content: unknown): LeafletContent | null {
  if (!isRecord(content)) return null;
  if (content.$type !== LEAFLET_CONTENT) return null;
  return content as LeafletContent;
}
