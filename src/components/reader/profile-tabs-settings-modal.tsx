import * as stylex from "@stylexjs/stylex";

import type { ProfileTabId } from "#/lib/profile-tabs";
import { PROFILE_TAB_LABELS } from "#/lib/profile-tabs";

import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
} from "../../design-system/dialog";
import { Switch } from "../../design-system/switch";
import { uiColor } from "../../design-system/theme/color.stylex";
import { spacing } from "../../design-system/theme/spacing.stylex";
import {
  fontSize,
  fontWeight,
} from "../../design-system/theme/typography.stylex";

const styles = stylex.create({
  row: {
    alignItems: "center",
    display: "flex",
    gap: spacing["4"],
    justifyContent: "space-between",
    paddingBottom: spacing["3"],
    paddingTop: spacing["3"],
  },
  rowLabel: {
    color: uiColor.text1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  empty: {
    color: uiColor.text2,
    fontSize: fontSize.sm,
  },
});

export interface ProfileTabsSettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tabs that currently have content, in display order. */
  candidateTabs: ReadonlyArray<ProfileTabId>;
  /** Subset of `candidateTabs` currently shown on the profile. */
  visibleTabs: ReadonlyArray<ProfileTabId>;
  onToggleTab: (tabId: ProfileTabId, visible: boolean) => void;
}

/**
 * Owner-only modal for choosing which content tabs appear on a public profile.
 * Presentational: state and persistence live in the profile route.
 */
export function ProfileTabsSettingsModal({
  isOpen,
  onOpenChange,
  candidateTabs,
  visibleTabs,
  onToggleTab,
}: ProfileTabsSettingsModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="sm"
      fitContent
      trigger={<span hidden aria-hidden />}
    >
      <DialogHeader>Profile settings</DialogHeader>
      <DialogDescription>
        Choose which tabs appear on your public profile.
      </DialogDescription>
      <DialogBody>
        {candidateTabs.length === 0 ? (
          <p {...stylex.props(styles.empty)}>
            You don&apos;t have any content tabs to show yet.
          </p>
        ) : (
          candidateTabs.map((tabId) => {
            const visible = visibleTabs.includes(tabId);
            const label = PROFILE_TAB_LABELS[tabId];
            return (
              <div key={tabId} {...stylex.props(styles.row)}>
                <span {...stylex.props(styles.rowLabel)}>{label}</span>
                <Switch
                  isSelected={visible}
                  onChange={(next) => onToggleTab(tabId, next)}
                  aria-label={`Show ${label} tab`}
                />
              </div>
            );
          })
        )}
      </DialogBody>
    </Dialog>
  );
}
