"use client";

import type { LeafletCodeBlock } from "#/lib/leaflet/types";

import * as stylex from "@stylexjs/stylex";

import { articleBodyStyles } from "../body-styles";

export function LeafletCodeBlockView({ block }: { block: LeafletCodeBlock }) {
  if (!block.plaintext) return null;

  return (
    <pre {...stylex.props(articleBodyStyles.codeBlock)}>
      <code>{block.plaintext}</code>
    </pre>
  );
}
