"use client";

import * as stylex from "@stylexjs/stylex";

import { articleBodyStyles } from "../body-styles";

export function LeafletHorizontalRuleBlockView() {
  return <hr {...stylex.props(articleBodyStyles.horizontalRule)} />;
}
