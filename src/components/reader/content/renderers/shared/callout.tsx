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
import { amber } from "#/design-system/theme/colors/amber.stylex";
import { blue } from "#/design-system/theme/colors/blue.stylex";
import { cyan } from "#/design-system/theme/colors/cyan.stylex";
import { gray } from "#/design-system/theme/colors/gray.stylex";
import { green } from "#/design-system/theme/colors/green.stylex";
import { orange } from "#/design-system/theme/colors/orange.stylex";
import { purple } from "#/design-system/theme/colors/purple.stylex";
import { red } from "#/design-system/theme/colors/red.stylex";
import { teal } from "#/design-system/theme/colors/teal.stylex";
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

// Each kind maps to a Radix color scale via four custom properties the layout
// styles above consume: surface (bgSubtle), border, accent (icon + title), and
// body text. StyleX needs these spelled out literally, so `note` and `todo`
// (both blue), `tip` and `success` (both green), and the red family repeat the
// same tokens rather than sharing a helper.
const kindTheme = stylex.create({
  note: {
    "--callout-surface": blue.bgSubtle,
    "--callout-border": blue.border1,
    "--callout-accent": blue.text1,
    "--callout-body": blue.text2,
  },
  abstract: {
    "--callout-surface": teal.bgSubtle,
    "--callout-border": teal.border1,
    "--callout-accent": teal.text1,
    "--callout-body": teal.text2,
  },
  info: {
    "--callout-surface": cyan.bgSubtle,
    "--callout-border": cyan.border1,
    "--callout-accent": cyan.text1,
    "--callout-body": cyan.text2,
  },
  todo: {
    "--callout-surface": blue.bgSubtle,
    "--callout-border": blue.border1,
    "--callout-accent": blue.text1,
    "--callout-body": blue.text2,
  },
  tip: {
    "--callout-surface": green.bgSubtle,
    "--callout-border": green.border1,
    "--callout-accent": green.text1,
    "--callout-body": green.text2,
  },
  success: {
    "--callout-surface": green.bgSubtle,
    "--callout-border": green.border1,
    "--callout-accent": green.text1,
    "--callout-body": green.text2,
  },
  question: {
    "--callout-surface": amber.bgSubtle,
    "--callout-border": amber.border1,
    "--callout-accent": amber.text1,
    "--callout-body": amber.text2,
  },
  warning: {
    "--callout-surface": orange.bgSubtle,
    "--callout-border": orange.border1,
    "--callout-accent": orange.text1,
    "--callout-body": orange.text2,
  },
  failure: {
    "--callout-surface": red.bgSubtle,
    "--callout-border": red.border1,
    "--callout-accent": red.text1,
    "--callout-body": red.text2,
  },
  danger: {
    "--callout-surface": red.bgSubtle,
    "--callout-border": red.border1,
    "--callout-accent": red.text1,
    "--callout-body": red.text2,
  },
  bug: {
    "--callout-surface": red.bgSubtle,
    "--callout-border": red.border1,
    "--callout-accent": red.text1,
    "--callout-body": red.text2,
  },
  example: {
    "--callout-surface": purple.bgSubtle,
    "--callout-border": purple.border1,
    "--callout-accent": purple.text1,
    "--callout-body": purple.text2,
  },
  quote: {
    "--callout-surface": gray.bgSubtle,
    "--callout-border": gray.border1,
    "--callout-accent": gray.text1,
    "--callout-body": gray.text2,
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
