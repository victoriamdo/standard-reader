"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import * as stylex from "@stylexjs/stylex";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button as AriaButton, Heading } from "react-aria-components";

import { IconButton } from "#/design-system/icon-button";
import { Popover } from "#/design-system/popover";
import { Tag, TagGroup } from "#/design-system/tag-group";
import { animationDuration } from "#/design-system/theme/animations.stylex";
import { primaryColor, uiColor } from "#/design-system/theme/color.stylex";
import { mediaQueries } from "#/design-system/theme/media-queries.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import { spacing } from "#/design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  typeramp,
} from "#/design-system/theme/typography.stylex";

import type { TopicChipItem } from "./discover-topics";

const styles = stylex.create({
  filterTrigger: {
    borderColor: {
      default: primaryColor.border3,
      ":is([data-hovered])": primaryColor.border3,
      ":is([data-pressed])": primaryColor.border3,
    },
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: {
      default: primaryColor.component1,
      ":is([data-hovered])": primaryColor.component2,
      ":is([data-pressed])": primaryColor.component3,
    },
    color: {
      default: primaryColor.text2,
      ":is([data-hovered])": primaryColor.text2,
    },
    cursor: "default",
    display: "flex",
    justifyContent: "center",
    transitionDuration: animationDuration.fast,
    transitionProperty: {
      default: "background-color, border-color, color",
      [mediaQueries.reducedMotion]: "none",
    },
    transitionTimingFunction: "ease-in-out",
    paddingBottom: verticalSpace["xs"],
    paddingInlineStart: horizontalSpace["lg"],
    paddingInlineEnd: horizontalSpace["lg"],
    paddingTop: verticalSpace["xs"],
  },
  filterTriggerText: {
    // eslint-disable-next-line @stylexjs/valid-styles
    textBoxEdge: "cap alphabetic",
    // eslint-disable-next-line @stylexjs/valid-styles
    textBoxTrim: "trim-both",
    paddingBottom: verticalSpace["xxs"],
    paddingTop: verticalSpace["xxs"],
  },
  popoverPanel: {
    paddingBottom: spacing["0"],
    paddingInlineStart: spacing["0"],
    paddingInlineEnd: spacing["0"],
    paddingTop: spacing["0"],
  },
  popoverHeader: {
    gap: gap["md"],
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBottom: verticalSpace["md"],
    paddingInlineStart: horizontalSpace["lg"],
    paddingInlineEnd: horizontalSpace["sm"],
    paddingTop: verticalSpace["md"],
  },
  popoverTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing["0"],
    marginTop: spacing["0"],
  },
  popoverBody: {
    outline: "none",
    maxHeight: spacing["64"],
    maxWidth: spacing["80"],
    minWidth: spacing["48"],
    overflowY: "auto",
    paddingBottom: verticalSpace["lg"],
    paddingInlineStart: horizontalSpace["lg"],
    paddingInlineEnd: horizontalSpace["lg"],
    paddingTop: verticalSpace["lg"],
  },
});

interface DiscoverTopicFiltersProps {
  topicKey: string;
  topicItems: Array<TopicChipItem>;
  onTopicChange: (keys: Set<React.Key> | "all") => void;
}

function selectionId(keys: Set<React.Key> | "all"): string | null {
  if (keys === "all") return "all";
  if (keys.size === 0) return null;
  return String([...keys][0]);
}

export function DiscoverTopicFilters({
  topicKey,
  topicItems,
  onTopicChange,
}: DiscoverTopicFiltersProps) {
  const { t } = useLingui();
  const [pickerOpen, setPickerOpen] = useState(false);

  const triggerLabel = useMemo(() => {
    if (topicKey === "all") return t`All`;
    const match = topicItems.find((item) => item.id === topicKey);
    return match?.name ?? topicKey;
  }, [t, topicKey, topicItems]);

  const clearTopicFilter = () => {
    onTopicChange("all");
  };

  const applyTopicSelection = (keys: Set<React.Key> | "all") => {
    const id = selectionId(keys);
    if (id == null || id === topicKey) {
      clearTopicFilter();
      return;
    }
    if (id === "all") {
      clearTopicFilter();
      return;
    }
    onTopicChange(new Set([id]));
  };

  const onPickerTopicChange = (keys: Set<React.Key> | "all") => {
    applyTopicSelection(keys);
    setPickerOpen(false);
  };

  return (
    <Popover
      isOpen={pickerOpen}
      onOpenChange={setPickerOpen}
      placement="bottom start"
      style={styles.popoverPanel}
      trigger={
        <AriaButton
          {...stylex.props(styles.filterTrigger, typeramp.label)}
          aria-label={t`Filter by topic: ${triggerLabel}`}
        >
          <span dir="auto" {...stylex.props(styles.filterTriggerText)}>
            {triggerLabel}
          </span>
        </AriaButton>
      }
    >
      <div {...stylex.props(styles.popoverHeader)}>
        <Heading slot="title" {...stylex.props(styles.popoverTitle)}>
          <Trans>Filter by topic</Trans>
        </Heading>
        <IconButton label={t`Close`} size="sm" variant="tertiary" slot="close">
          <X size={16} />
        </IconButton>
      </div>

      <div {...stylex.props(styles.popoverBody)}>
        <TagGroup
          aria-label={t`Filter by topic`}
          selectionMode="single"
          selectedKeys={new Set([topicKey])}
          onSelectionChange={onPickerTopicChange}
          items={topicItems}
        >
          {(item) => (
            // Topic values come from the network (author-supplied), so let the
            // browser resolve their direction rather than inheriting the UI's.
            <Tag id={item.id}>
              <span dir="auto">{item.name}</span>
            </Tag>
          )}
        </TagGroup>
      </div>
    </Popover>
  );
}
