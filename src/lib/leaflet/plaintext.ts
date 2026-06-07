import type { LeafletTextBlock } from "./types";

import { leafletBlocks, plaintextLinesFromBlock } from "./blocks";

/** Collect every `pub.leaflet.blocks.text` block from leaflet content. */
export function leafletTextBlocks(content: unknown): Array<LeafletTextBlock> {
  return leafletBlocks(content)
    .filter((block) => block.kind === "text")
    .map((block) => block.block);
}

/** Flatten leaflet content to a single plaintext string (paragraphs joined). */
export function leafletPlaintext(content: unknown): string | null {
  const blocks = leafletBlocks(content);
  if (blocks.length === 0) return null;
  const text = blocks
    .flatMap((block) => plaintextLinesFromBlock(block))
    .join("\n\n");
  return text || null;
}

export { asLeafletContent, asTextBlock } from "./blocks";
