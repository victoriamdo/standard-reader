"use client";

import * as stylex from "@stylexjs/stylex";
import { useCallback } from "react";

import {
  PUBLISHING_DOCS_SCROLL_SPY_IDS,
  publishingDocsJumpNavGroups,
} from "#/lib/publishing-docs/navigation";

import { docsStyles } from "./docs-page.stylex";
import { useDocsScrollSpyActive } from "./docs-scroll-spy-context";

const groups = publishingDocsJumpNavGroups();

export function DocsPublishingMobileJumpNav() {
  const active = useDocsScrollSpyActive();
  const value = active ?? PUBLISHING_DOCS_SCROLL_SPY_IDS[0] ?? "";

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const id = event.target.value;
      const target = document.querySelector(`#${id}`);
      if (target == null) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      globalThis.history.replaceState(null, "", `#${id}`);
    },
    [],
  );

  return (
    <div {...stylex.props(docsStyles.mobileJumpBar)}>
      <label
        {...stylex.props(docsStyles.mobileJumpLabel)}
        htmlFor="docs-publishing-jump-nav"
      >
        Jump to
      </label>
      <select
        id="docs-publishing-jump-nav"
        {...stylex.props(docsStyles.mobileJumpSelect)}
        value={value}
        onChange={onChange}
        aria-label="Jump to section"
      >
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
