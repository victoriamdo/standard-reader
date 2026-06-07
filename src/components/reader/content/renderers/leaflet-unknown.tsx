"use client";

import * as stylex from "@stylexjs/stylex";

import { articleBodyStyles } from "../body-styles";

export function LeafletUnknownBlockView({ blockType }: { blockType: string }) {
  return (
    <p {...stylex.props(articleBodyStyles.unknownBlock)} role="note">
      Unsupported content block ({blockType})
    </p>
  );
}
