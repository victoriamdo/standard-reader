import { blobCid } from "#/server/atproto/blob";

import type { LeafletImageBlock } from "./types";

/** Pull the CID string from a leaflet `image` blob field. */
export function leafletImageCid(image: unknown): string | null {
  return blobCid(image as Parameters<typeof blobCid>[0]);
}

/** Build a `com.atproto.sync.getBlob` URL for a blob on the authoring repo's PDS. */
export function leafletImageUrl(
  block: LeafletImageBlock,
  did: string,
  pds: string | null | undefined,
): string | null {
  const cid = leafletImageCid(block.image);
  if (!cid || !pds) return null;
  const base = pds.replace(/\/+$/, "");
  return `${base}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(
    did,
  )}&cid=${encodeURIComponent(cid)}`;
}

/** Width ÷ height for layout; falls back to 16∶9 when missing or invalid. */
export function leafletImageAspectRatio(block: LeafletImageBlock): number {
  const width = block.aspectRatio?.width;
  const height = block.aspectRatio?.height;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return width / height;
  }
  return 16 / 9;
}
