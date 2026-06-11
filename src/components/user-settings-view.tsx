"use client";

import type {
  ReadingBodyFont,
  ReadingFontSize,
  ReadingMeasure,
} from "#/lib/reading-typography";
import type { ThemeMode } from "#/lib/theme";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateReadQueries } from "#/components/reader/read-optimistic";
import { feedApi } from "#/integrations/tanstack-query/api-feed.functions";
import { listApi } from "#/integrations/tanstack-query/api-lists.functions";
import { readerApi } from "#/integrations/tanstack-query/api-reader.functions";
import { AMERICAN_ENGLISH_VOICES } from "#/lib/page-reader/voice-catalog";
import { isReaderVoicePreference } from "#/lib/reader-voice";
import {
  READING_BODY_FONTS,
  READING_FONT_SIZES,
  READING_MEASURES,
  readingBodyFontLabel,
  readingFontSizeLabel,
  readingMeasureLabel,
} from "#/lib/reading-typography";
import { isThemeMode } from "#/lib/theme";
import { useOpenLinks } from "#/lib/use-open-links";
import { useReaderVoice } from "#/lib/use-reader-voice";
import { useReadingTypography } from "#/lib/use-reading-typography";
import { useTheme } from "#/lib/use-theme";
import { useTrackReadingHistory } from "#/lib/use-track-reading-history";
import { Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { Select, SelectItem } from "../design-system/select";
import { Separator } from "../design-system/separator";
import { Switch } from "../design-system/switch";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { spacing } from "../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../design-system/theme/typography.stylex";
import { Masthead, ReaderContent } from "./reader/primitives";

const MOBILE = "@media (max-width: 47.5rem)";

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
}> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const READER_VOICE_ITEMS = [
  { id: "auto", label: "Auto" },
  ...AMERICAN_ENGLISH_VOICES.map((voice) => ({
    id: voice.id,
    label: `${voice.name} (${voice.overallGrade})`,
  })),
] as const;

const styles = stylex.create({
  section: {
    marginTop: verticalSpace["7xl"],
  },
  sectionHeading: {
    color: primaryColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.widest,
    textTransform: "uppercase",
    marginBottom: verticalSpace["3xl"],
  },
  settingGroup: {
    borderColor: uiColor.border1,
    borderRadius: spacing["2"],
    borderStyle: "solid",
    borderWidth: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  settingRow: {
    alignItems: {
      [MOBILE]: "stretch",
      default: "center",
    },
    columnGap: gap["3xl"],
    display: "flex",
    flexDirection: {
      [MOBILE]: "column",
      default: "row",
    },
    justifyContent: "space-between",
    rowGap: gap["lg"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  settingLabel: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.sm,
    marginBottom: verticalSpace.xs,
    marginTop: verticalSpace.none,
  },
  settingDescription: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.sm,
    marginBottom: verticalSpace.none,
    marginTop: verticalSpace.none,
    maxWidth: "42ch",
  },
  settingControl: {
    flexShrink: 0,
    width: {
      [MOBILE]: "100%",
      default: "auto",
    },
  },
  segmentedControl: {
    width: {
      [MOBILE]: "100%",
      default: "auto",
    },
  },
  voiceSelect: {
    minWidth: {
      [MOBILE]: "100%",
      default: spacing["56"],
    },
    width: {
      [MOBILE]: "100%",
      default: spacing["56"],
    },
  },
  deletionRow: {
    alignItems: {
      [MOBILE]: "stretch",
      default: "center",
    },
    columnGap: gap["3xl"],
    display: "flex",
    flexDirection: {
      [MOBILE]: "column",
      default: "row",
    },
    justifyContent: "space-between",
    rowGap: gap["lg"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  deletionIntro: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    marginBottom: verticalSpace["3xl"],
    marginTop: verticalSpace.none,
    maxWidth: "52ch",
  },
});

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div {...stylex.props(styles.settingRow)}>
      <div>
        <p {...stylex.props(styles.settingLabel)}>{label}</p>
        {description ? (
          <p {...stylex.props(styles.settingDescription)}>{description}</p>
        ) : null}
      </div>
      <div {...stylex.props(styles.settingControl)}>{children}</div>
    </div>
  );
}

function DataDeletionRow({
  label,
  description,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  isPending,
  onConfirm,
}: {
  label: string;
  description: string;
  dialogTitle: string;
  dialogDescription: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: (close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div {...stylex.props(styles.deletionRow)}>
      <div>
        <p {...stylex.props(styles.settingLabel)}>{label}</p>
        <p {...stylex.props(styles.settingDescription)}>{description}</p>
      </div>
      <AlertDialog
        isOpen={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="critical-outline" onPress={() => setOpen(true)}>
            Delete
          </Button>
        }
      >
        <AlertDialogHeader>{dialogTitle}</AlertDialogHeader>
        <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancelButton isDisabled={isPending}>
            Cancel
          </AlertDialogCancelButton>
          <AlertDialogActionButton
            variant="critical"
            closeOnPress={false}
            isPending={isPending}
            onPress={() => onConfirm(() => setOpen(false))}
          >
            {confirmLabel}
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}

export function UserSettingsView() {
  const queryClient = useQueryClient();
  const { mode, setMode } = useTheme();
  const { preference: voice, setPreference: setVoice } = useReaderVoice();
  const { preference: typography, setPreference: setTypography } =
    useReadingTypography();
  const { openExternally, setOpenExternally } = useOpenLinks();
  const { enabled: trackReading, setEnabled: setTrackReading } =
    useTrackReadingHistory();

  const deleteHistoryMutation = useMutation(
    readerApi.deleteAllReadHistoryMutationOptions(),
  );
  const deleteBookmarksMutation = useMutation(
    readerApi.deleteAllBookmarksMutationOptions(),
  );
  const deleteListsMutation = useMutation(
    listApi.deleteAllListsMutationOptions(),
  );

  const onDeleteHistory = (close: () => void) => {
    deleteHistoryMutation.mutate(undefined, {
      onSuccess: () => {
        close();
        invalidateReadQueries(queryClient);
      },
    });
  };

  const onDeleteBookmarks = (close: () => void) => {
    deleteBookmarksMutation.mutate(undefined, {
      onSuccess: () => {
        close();
        void queryClient.invalidateQueries({ queryKey: ["reader", "saved"] });
        void queryClient.invalidateQueries({
          queryKey: ["reader", "bookmarkStatus"],
        });
        void queryClient.invalidateQueries({
          queryKey: feedApi.getSidebarQueryOptions().queryKey,
        });
      },
    });
  };

  const onDeleteLists = (close: () => void) => {
    deleteListsMutation.mutate(undefined, {
      onSuccess: () => {
        close();
        void queryClient.invalidateQueries({ queryKey: ["reader", "lists"] });
        void queryClient.invalidateQueries({
          queryKey: feedApi.getSidebarQueryOptions().queryKey,
        });
      },
    });
  };

  return (
    <ReaderContent>
      <Masthead
        kicker="Account"
        title="Settings"
        dek="Appearance, reading preferences, and personal data."
      />

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionHeading)}>Appearance</h2>
        <div {...stylex.props(styles.settingGroup)}>
          <SettingRow
            label="Theme"
            description="Choose light, dark, or match your system setting."
          >
            <SegmentedControl
              selectedKeys={new Set([mode])}
              onSelectionChange={(keys: Set<React.Key> | "all") => {
                const key = keys === "all" ? undefined : String([...keys][0]);
                if (isThemeMode(key)) setMode(key);
              }}
              style={styles.segmentedControl}
            >
              {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
                <SegmentedControlItem key={id} id={id}>
                  <Flex align="center" gap="xs">
                    <Icon size={14} />
                    {label}
                  </Flex>
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </SettingRow>
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionHeading)}>Behavior</h2>
        <div {...stylex.props(styles.settingGroup)}>
          <SettingRow
            label="Open posts externally"
            description="When on, links open on the original website instead of the in-app reader."
          >
            <Switch
              isSelected={openExternally}
              onChange={setOpenExternally}
              aria-label="Open posts externally"
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label="Track reading history"
            description="When on, articles you open are recorded as public read records in your AT Protocol repository."
          >
            <Switch
              isSelected={trackReading}
              onChange={setTrackReading}
              aria-label="Track reading history"
            />
          </SettingRow>
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionHeading)}>Reading</h2>
        <div {...stylex.props(styles.settingGroup)}>
          <SettingRow label="Text size">
            <SegmentedControl
              selectedKeys={new Set([typography.fontSize])}
              onSelectionChange={(keys: Set<React.Key> | "all") => {
                const key = keys === "all" ? undefined : String([...keys][0]);
                if (
                  typeof key === "string" &&
                  (READING_FONT_SIZES as ReadonlyArray<string>).includes(key)
                ) {
                  setTypography({ fontSize: key as ReadingFontSize });
                }
              }}
              style={styles.segmentedControl}
            >
              {READING_FONT_SIZES.map((fontSizeOption) => (
                <SegmentedControlItem key={fontSizeOption} id={fontSizeOption}>
                  {readingFontSizeLabel(fontSizeOption)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </SettingRow>
          <Separator />
          <SettingRow label="Column width">
            <SegmentedControl
              selectedKeys={new Set([typography.measure])}
              onSelectionChange={(keys: Set<React.Key> | "all") => {
                const key = keys === "all" ? undefined : String([...keys][0]);
                if (
                  typeof key === "string" &&
                  (READING_MEASURES as ReadonlyArray<string>).includes(key)
                ) {
                  setTypography({ measure: key as ReadingMeasure });
                }
              }}
              style={styles.segmentedControl}
            >
              {READING_MEASURES.map((measureOption) => (
                <SegmentedControlItem key={measureOption} id={measureOption}>
                  {readingMeasureLabel(measureOption)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </SettingRow>
          <Separator />
          <SettingRow label="Body font">
            <SegmentedControl
              selectedKeys={new Set([typography.bodyFont])}
              onSelectionChange={(keys: Set<React.Key> | "all") => {
                const key = keys === "all" ? undefined : String([...keys][0]);
                if (
                  typeof key === "string" &&
                  (READING_BODY_FONTS as ReadonlyArray<string>).includes(key)
                ) {
                  setTypography({ bodyFont: key as ReadingBodyFont });
                }
              }}
              style={styles.segmentedControl}
            >
              {READING_BODY_FONTS.map((bodyFontOption) => (
                <SegmentedControlItem key={bodyFontOption} id={bodyFontOption}>
                  {readingBodyFontLabel(bodyFontOption)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </SettingRow>
          <Separator />
          <SettingRow
            label="Listen aloud voice"
            description="The voice used when you listen to an article with read aloud."
          >
            <Select
              aria-label="Reader voice"
              items={READER_VOICE_ITEMS}
              value={voice}
              style={styles.voiceSelect}
              onChange={(key) => {
                if (isReaderVoicePreference(key)) setVoice(key);
              }}
            >
              {(item) => (
                <SelectItem id={item.id}>
                  {item.id === "auto" ? (
                    <Flex align="center" gap="xs">
                      <Sparkles size={14} />
                      Auto
                    </Flex>
                  ) : (
                    item.label
                  )}
                </SelectItem>
              )}
            </Select>
          </SettingRow>
        </div>
      </section>

      <section {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionHeading)}>Personal data</h2>
        <p {...stylex.props(styles.deletionIntro)}>
          Permanently remove data stored in your account. These actions delete
          records from your AT Protocol repository and cannot be undone.
        </p>
        <div {...stylex.props(styles.settingGroup)}>
          <DataDeletionRow
            label="Reading history"
            description="All articles you have marked as read."
            dialogTitle="Delete all reading history?"
            dialogDescription="Every read record in your repository will be removed. Articles will appear unread again across the app. This cannot be undone."
            confirmLabel="Delete history"
            isPending={deleteHistoryMutation.isPending}
            onConfirm={onDeleteHistory}
          />
          <Separator />
          <DataDeletionRow
            label="Bookmarks"
            description="All articles you have saved for later."
            dialogTitle="Delete all bookmarks?"
            dialogDescription="Every saved article will be removed from your repository. Your Saved for later list will be empty. This cannot be undone."
            confirmLabel="Delete bookmarks"
            isPending={deleteBookmarksMutation.isPending}
            onConfirm={onDeleteBookmarks}
          />
          <Separator />
          <DataDeletionRow
            label="Publication lists"
            description="All publication lists you created in this app."
            dialogTitle="Delete all lists?"
            dialogDescription="Every list you own will be removed from your account. Anyone who saved your lists will no longer see them in their sidebar. This cannot be undone."
            confirmLabel="Delete lists"
            isPending={deleteListsMutation.isPending}
            onConfirm={onDeleteLists}
          />
        </div>
      </section>
    </ReaderContent>
  );
}
