"use client";

import type { LeafletImageBlock } from "#/lib/leaflet/types";

import * as stylex from "@stylexjs/stylex";
import { leafletImageAspectRatio, leafletImageUrl } from "#/lib/leaflet/image";

import type { ContentBlobContext } from "../types";

import { AspectRatio, AspectRatioImage } from "#/design-system/aspect-ratio";
import { articleBodyStyles } from "../body-styles";

export function LeafletImageBlockView({
  block,
  blobContext,
}: {
  block: LeafletImageBlock;
  blobContext?: ContentBlobContext;
}) {
  if (!blobContext) return null;

  const src = leafletImageUrl(
    block,
    blobContext.authorDid,
    blobContext.authorPds,
  );
  if (!src) return null;

  const alt = block.alt?.trim() ?? "";
  const aspectRatio = leafletImageAspectRatio(block);

  return (
    <figure
      {...stylex.props(
        articleBodyStyles.imageFigure,
        block.fullBleed && articleBodyStyles.imageFullBleed,
      )}
    >
      <AspectRatio aspectRatio={aspectRatio} rounded={!block.fullBleed}>
        <AspectRatioImage alt={alt} referrerPolicy="no-referrer" src={src} />
      </AspectRatio>
    </figure>
  );
}
