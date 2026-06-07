"use client";

import type { LeafletIframeBlock } from "#/lib/leaflet/types";

import * as stylex from "@stylexjs/stylex";

import { articleBodyStyles } from "../body-styles";

function iframeAspectRatio(block: LeafletIframeBlock): string {
  const width = block.aspectRatio?.width;
  const height = block.aspectRatio?.height;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return `${width} / ${height}`;
  }
  return "16 / 9";
}

export function LeafletIframeBlockView({ block }: { block: LeafletIframeBlock }) {
  if (!block.url) return null;

  return (
    <figure {...stylex.props(articleBodyStyles.iframeFigure)}>
      <div
        {...stylex.props(articleBodyStyles.iframeFrame)}
        style={{ aspectRatio: iframeAspectRatio(block) }}
      >
        <iframe
          src={block.url}
          title="Embedded content"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          {...stylex.props(articleBodyStyles.iframeEmbed)}
        />
      </div>
    </figure>
  );
}
