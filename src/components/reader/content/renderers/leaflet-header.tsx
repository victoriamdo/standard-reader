"use client";

import type { LeafletHeaderBlock } from "#/lib/leaflet/types";

import * as stylex from "@stylexjs/stylex";
import { createElement } from "react";

import { articleBodyStyles } from "../body-styles";

export function LeafletHeaderBlockView({
  block,
}: {
  block: LeafletHeaderBlock;
}) {
  if (!block.plaintext) return null;
  const level = Math.min(6, Math.max(1, block.level ?? 2));
  const style =
    level <= 1 ? articleBodyStyles.heading1 : articleBodyStyles.heading2;

  return createElement(
    `h${level}`,
    { ...stylex.props(style) },
    block.plaintext,
  );
}
