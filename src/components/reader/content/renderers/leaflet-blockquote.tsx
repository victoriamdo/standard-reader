"use client";

import type { LeafletBlockquoteBlock } from "#/lib/leaflet/types";

import * as stylex from "@stylexjs/stylex";

import { articleBodyStyles } from "../body-styles";
import { FacetedPlaintext } from "./leaflet-text";

export function LeafletBlockquoteBlockView({
  block,
}: {
  block: LeafletBlockquoteBlock;
}) {
  if (!block.plaintext) return null;

  return (
    <blockquote {...stylex.props(articleBodyStyles.pullquote)}>
      <FacetedPlaintext plaintext={block.plaintext} facets={block.facets} />
    </blockquote>
  );
}
