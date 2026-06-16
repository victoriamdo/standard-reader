"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { Flex } from "../../design-system/flex";
import { MarkdownContent } from "../../design-system/markdown-content";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../../design-system/segmented-control";
import { TextArea } from "../../design-system/text-area";
import { uiColor } from "../../design-system/theme/color.stylex";
import { radius } from "../../design-system/theme/radius.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "../../design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "../../design-system/theme/typography.stylex";

const styles = stylex.create({
  label: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  preview: {
    borderColor: uiColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    minHeight: "4rem",
    paddingBottom: verticalSpace.md,
    paddingLeft: horizontalSpace.lg,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.md,
  },
  empty: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.sm,
    fontStyle: "italic",
  },
});

/**
 * A markdown input with an Edit/Preview toggle. We don't have a rich-text
 * editor, so authors write markdown and preview the rendered result. Reused for
 * the collection editorial and per-piece notes.
 */
export function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const trimmed = value.trim();

  return (
    <Flex direction="column" gap="sm">
      <Flex align="center" justify="between" gap="md">
        <span {...stylex.props(styles.label)}>{label}</span>
        <SegmentedControl
          aria-label={`${label} mode`}
          selectedKeys={new Set([mode])}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next === "edit" || next === "preview") setMode(next);
          }}
        >
          <SegmentedControlItem id="edit">Edit</SegmentedControlItem>
          <SegmentedControlItem id="preview">Preview</SegmentedControlItem>
        </SegmentedControl>
      </Flex>

      {mode === "edit" ? (
        <TextArea
          aria-label={label}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <div {...stylex.props(styles.preview)}>
          {trimmed ? (
            <MarkdownContent content={trimmed} />
          ) : (
            <span {...stylex.props(styles.empty)}>Nothing to preview yet.</span>
          )}
        </div>
      )}
    </Flex>
  );
}
