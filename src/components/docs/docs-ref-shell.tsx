"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { docsStyles } from "./docs-page.stylex";
import { DocsScrollSpyProvider } from "./docs-scroll-spy-context";

export function DocsRefShell({
  scrollSpyIds,
  nav,
  mobileJumpNav,
  children,
}: {
  scrollSpyIds: Array<string>;
  nav: ReactNode;
  mobileJumpNav: ReactNode;
  children: ReactNode;
}) {
  return (
    <DocsScrollSpyProvider ids={scrollSpyIds}>
      {mobileJumpNav}
      <div {...stylex.props(docsStyles.refLayout)}>
        {nav}
        <main {...stylex.props(docsStyles.refMain)}>{children}</main>
      </div>
    </DocsScrollSpyProvider>
  );
}
