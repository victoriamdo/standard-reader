"use client";

import * as stylex from "@stylexjs/stylex";

import { PUBLISHING_DOCS_IDS } from "#/lib/publishing-docs/navigation";

import { docsStyles } from "./docs-page.stylex";
import { useDocsScrollSpyActive } from "./docs-scroll-spy-context";

const LINKS = [
  { id: PUBLISHING_DOCS_IDS.overview, label: "Overview" },
  { id: PUBLISHING_DOCS_IDS.discovery, label: "Discovery" },
  { id: PUBLISHING_DOCS_IDS.subscribeEmbed, label: "Subscribe embed" },
  {
    id: PUBLISHING_DOCS_IDS.inlineReading,
    label: "Rendering Content in Standard Reader",
  },
  {
    id: PUBLISHING_DOCS_IDS.contentFormats,
    label: "Supported content formats",
    nested: true,
  },
  { id: PUBLISHING_DOCS_IDS.example, label: "Example record", nested: true },
] as const;

export function DocsPublishingNav() {
  const active = useDocsScrollSpyActive();

  return (
    <nav {...stylex.props(docsStyles.refNav)} aria-label="Publishing guide">
      <div {...stylex.props(docsStyles.refNavGroup)}>
        <div {...stylex.props(docsStyles.refNavHeadingRow)}>
          <span {...stylex.props(docsStyles.refNavHeading)}>On this page</span>
        </div>
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            {...stylex.props(
              docsStyles.refNavLink,
              "nested" in link && link.nested && docsStyles.refNavLinkNested,
              active === link.id && docsStyles.refNavLinkActive,
            )}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
