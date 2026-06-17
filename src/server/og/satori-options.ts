import type { Font, SatoriOptions } from "satori";

import { loadAppleEmojiAsset } from "#/server/og/emoji";

export function ogSatoriOptions(
  fonts: Array<Font>,
  size: { width: number; height: number },
): SatoriOptions {
  return {
    width: size.width,
    height: size.height,
    fonts,
    loadAdditionalAsset: loadAppleEmojiAsset as NonNullable<
      SatoriOptions["loadAdditionalAsset"]
    >,
  };
}
