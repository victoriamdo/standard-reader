"use client";

import * as stylex from "@stylexjs/stylex";
import {
  Bug,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Info,
  Lightbulb,
  List,
  ListTodo,
  Pencil,
  Quote,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { animationDuration } from "#/design-system/theme/animations.stylex";
import { amberA } from "#/design-system/theme/colors/amber.stylex";
import { blueA } from "#/design-system/theme/colors/blue.stylex";
import { cyanA } from "#/design-system/theme/colors/cyan.stylex";
import { grayA } from "#/design-system/theme/colors/gray.stylex";
import { greenA } from "#/design-system/theme/colors/green.stylex";
import { orangeA } from "#/design-system/theme/colors/orange.stylex";
import { purpleA } from "#/design-system/theme/colors/purple.stylex";
import { redA } from "#/design-system/theme/colors/red.stylex";
import { tealA } from "#/design-system/theme/colors/teal.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import { spacing } from "#/design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "#/design-system/theme/typography.stylex";
import type { CalloutKind } from "#/lib/markdown/callouts";

const KIND_ICON: Record<CalloutKind, LucideIcon> = {
  note: Pencil,
  abstract: ClipboardList,
  info: Info,
  todo: ListTodo,
  tip: Lightbulb,
  success: Check,
  question: CircleHelp,
  warning: TriangleAlert,
  failure: X,
  danger: Zap,
  bug: Bug,
  example: List,
  quote: Quote,
};

const styles = stylex.create({
  callout: {
    backgroundColor: "var(--callout-surface)",
    borderColor: "var(--callout-border)",
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
    cornerShape: "squircle",
    fontFamily: fontFamily.sans,
    marginBottom: spacing["6"],
    marginTop: spacing["6"],
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    color: "var(--callout-accent)",
    columnGap: spacing["2"],
    display: "flex",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.4,
    paddingBottom: spacing["3"],
    paddingLeft: spacing["4"],
    paddingRight: spacing["4"],
    paddingTop: spacing["3"],
  },
  headerButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    cursor: "pointer",
    textAlign: "start",
    width: "100%",
  },
  icon: {
    color: "var(--callout-accent)",
    flexShrink: 0,
    height: "1.125rem",
    width: "1.125rem",
  },
  title: {
    flexGrow: 1,
    minWidth: 0,
  },
  chevron: {
    flexShrink: 0,
    height: "1.125rem",
    transitionDuration: animationDuration.default,
    transitionProperty: "rotate",
    transitionTimingFunction: "ease",
    width: "1.125rem",
  },
  chevronOpen: {
    rotate: "90deg",
  },
  body: {
    // No font family: inherit the article's serif so callout prose matches the
    // surrounding body copy.
    color: "var(--callout-body)",
    fontSize: fontSize.base,
    lineHeight: 1.55,
    paddingBottom: spacing["1"],
    paddingLeft: spacing["4"],
    paddingRight: spacing["4"],
  },
});

// Each kind maps to a Radix *alpha* color scale via four custom properties the
// layout styles above consume: surface (bgSubtle), border, accent (icon +
// title), and body text. Alpha tokens composite over the reader's muted mauve
// background, so callouts read as a soft tint of the theme rather than a bright
// opaque panel. StyleX needs these spelled out literally, so `note`/`todo`
// (both blue), `tip`/`success` (both green), and the red family repeat the same
// tokens rather than sharing a helper.
const kindTheme = stylex.create({
  note: {
    "--callout-surface": blueA.bgSubtle,
    "--callout-border": blueA.border1,
    "--callout-accent": blueA.text1,
    "--callout-body": blueA.text2,
  },
  abstract: {
    "--callout-surface": tealA.bgSubtle,
    "--callout-border": tealA.border1,
    "--callout-accent": tealA.text1,
    "--callout-body": tealA.text2,
  },
  info: {
    "--callout-surface": cyanA.bgSubtle,
    "--callout-border": cyanA.border1,
    "--callout-accent": cyanA.text1,
    "--callout-body": cyanA.text2,
  },
  todo: {
    "--callout-surface": blueA.bgSubtle,
    "--callout-border": blueA.border1,
    "--callout-accent": blueA.text1,
    "--callout-body": blueA.text2,
  },
  tip: {
    "--callout-surface": greenA.bgSubtle,
    "--callout-border": greenA.border1,
    "--callout-accent": greenA.text1,
    "--callout-body": greenA.text2,
  },
  success: {
    "--callout-surface": greenA.bgSubtle,
    "--callout-border": greenA.border1,
    "--callout-accent": greenA.text1,
    "--callout-body": greenA.text2,
  },
  question: {
    "--callout-surface": amberA.bgSubtle,
    "--callout-border": amberA.border1,
    "--callout-accent": amberA.text1,
    "--callout-body": amberA.text2,
  },
  warning: {
    "--callout-surface": orangeA.bgSubtle,
    "--callout-border": orangeA.border1,
    "--callout-accent": orangeA.text1,
    "--callout-body": orangeA.text2,
  },
  failure: {
    "--callout-surface": redA.bgSubtle,
    "--callout-border": redA.border1,
    "--callout-accent": redA.text1,
    "--callout-body": redA.text2,
  },
  danger: {
    "--callout-surface": redA.bgSubtle,
    "--callout-border": redA.border1,
    "--callout-accent": redA.text1,
    "--callout-body": redA.text2,
  },
  bug: {
    "--callout-surface": redA.bgSubtle,
    "--callout-border": redA.border1,
    "--callout-accent": redA.text1,
    "--callout-body": redA.text2,
  },
  example: {
    "--callout-surface": purpleA.bgSubtle,
    "--callout-border": purpleA.border1,
    "--callout-accent": purpleA.text1,
    "--callout-body": purpleA.text2,
  },
  quote: {
    "--callout-surface": grayA.bgSubtle,
    "--callout-border": grayA.border1,
    "--callout-accent": grayA.text1,
    "--callout-body": grayA.text2,
  },
});

export function Callout({
  kind,
  title,
  fold,
  children,
}: {
  kind: CalloutKind;
  title: string;
  /** `"open"`/`"closed"` makes the callout collapsible; omit for a static one. */
  fold?: "open" | "closed";
  children: ReactNode;
}) {
  const Icon = KIND_ICON[kind];
  const bodyId = useId();
  const collapsible = fold !== undefined;
  const [open, setOpen] = useState(fold !== "closed");

  const headerInner = (
    <>
      <Icon aria-hidden {...stylex.props(styles.icon)} />
      <span {...stylex.props(styles.title)}>{title}</span>
      {collapsible ? (
        <ChevronRight
          aria-hidden
          {...stylex.props(styles.chevron, open && styles.chevronOpen)}
        />
      ) : null}
    </>
  );

  return (
    <div {...stylex.props(styles.callout, kindTheme[kind])}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          {...stylex.props(styles.header, styles.headerButton)}
        >
          {headerInner}
        </button>
      ) : (
        <div {...stylex.props(styles.header)}>{headerInner}</div>
      )}
      {(!collapsible || open) && (
        <div id={bodyId} {...stylex.props(styles.body)}>
          {children}
        </div>
      )}
    </div>
  );
}
