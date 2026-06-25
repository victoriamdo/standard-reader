"use client";

import type { LabelValueDef } from "#/integrations/tanstack-query/api-labelers.functions";
import type { Key } from "react";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArticleRow } from "#/components/reader/cards";
import { labelerApi } from "#/integrations/tanstack-query/api-labelers.functions";
import { useTrackReadingHistory } from "#/lib/use-track-reading-history";
import { Check } from "lucide-react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
} from "../design-system/empty-state";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { Tab, TabList, TabPanel, Tabs } from "../design-system/tabs";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  size as boxSize,
  gap,
} from "../design-system/theme/semantic-spacing.stylex";
import { spacing } from "../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../design-system/theme/typography.stylex";
import { Kicker, ReaderContent } from "./reader/primitives";

type Visibility = "ignore" | "warn" | "hide";
export type LabelerView = "labels" | "documents";

// Each label is a simple three-way toggle: off (ignore), warn (content warning /
// blur), or hide (filter it out entirely).
const VISIBILITY_OPTIONS: Array<{ id: Visibility; label: string }> = [
  { id: "ignore", label: "Off" },
  { id: "warn", label: "Warn" },
  { id: "hide", label: "Hide" },
];

function defName(def: LabelValueDef): string {
  return def.locales?.[0]?.name ?? def.identifier ?? "label";
}

function defDescription(def: LabelValueDef): string | undefined {
  return def.locales?.[0]?.description;
}

function labelValDisplayName(defs: Array<LabelValueDef>, val: string): string {
  const def = defs.find((d) => d.identifier === val);
  return def ? defName(def) : val;
}

function initials(name: string): string {
  return name
    .replace(/^did:\w+:/, "")
    .slice(0, 2)
    .toUpperCase();
}

export function LabelerDetailView({
  did,
  view,
}: {
  did: string;
  view: LabelerView;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const labeler = useQuery(labelerApi.getLabelerQueryOptions(did));
  const labeled = useQuery(labelerApi.getLabeledDocumentsQueryOptions(did));
  const { enabled: trackReading } = useTrackReadingHistory();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["labeler", did] });
    void queryClient.invalidateQueries({ queryKey: ["reader", "labelers"] });
    void queryClient.invalidateQueries({ queryKey: ["labels"] });
  };

  const subscribe = useMutation({
    ...labelerApi.subscribeLabelerMutationOptions(),
    onSuccess: invalidate,
  });
  const unsubscribe = useMutation({
    ...labelerApi.unsubscribeLabelerMutationOptions(),
    onSuccess: invalidate,
  });
  const setPref = useMutation({
    ...labelerApi.setLabelerPrefMutationOptions(),
    onSuccess: invalidate,
  });

  const card = labeler.data?.labeler ?? { did };
  const subscribed = labeler.data?.subscribed ?? false;
  const prefs = new Map<string, Visibility>(
    (labeler.data?.prefs ?? []).map((p) => [p.val, p.visibility]),
  );
  const name = card.displayName ?? card.did;
  const defs = card.labelValueDefinitions ?? [];
  const documents = labeled.data?.documents ?? [];
  const labelsByUri = labeled.data?.labelsByUri ?? {};

  const onViewChange = (key: Key) => {
    const next = key as LabelerView;
    void navigate({
      to: "/labelers/$did",
      params: { did },
      search: { view: next },
    });
  };

  return (
    <div>
      <div {...stylex.props(styles.heroInner)}>
        <div {...stylex.props(styles.avRing)}>
          <Avatar
            size="xl"
            src={card.avatar}
            fallback={initials(name)}
            alt={name}
            style={styles.avatar}
          />
        </div>

        <div {...stylex.props(styles.heroInfo)}>
          <Kicker>Labeler</Kicker>
          <h1 {...stylex.props(styles.heroName)}>{name}</h1>
          {card.description ? (
            <p {...stylex.props(styles.heroDesc)}>{card.description}</p>
          ) : null}
          <div {...stylex.props(styles.stats)}>
            <span {...stylex.props(styles.did)}>{card.did}</span>
            {defs.length > 0 ? (
              <span>
                <span {...stylex.props(styles.statValue)}>{defs.length}</span>
                {defs.length === 1 ? "label" : "labels"}
              </span>
            ) : null}
            {documents.length > 0 ? (
              <span>
                <span {...stylex.props(styles.statValue)}>
                  {documents.length}
                </span>
                {documents.length === 1 ? "document" : "documents"}
              </span>
            ) : null}
          </div>
        </div>

        <div {...stylex.props(styles.heroActs)}>
          <Button
            variant={subscribed ? "secondary" : "primary"}
            size="md"
            isPending={subscribed ? unsubscribe.isPending : subscribe.isPending}
            onPress={() =>
              subscribed
                ? unsubscribe.mutate(card.did)
                : subscribe.mutate(card.did)
            }
          >
            {subscribed ? <Check size={18} aria-hidden /> : null}
            {subscribed ? "Subscribed" : "Subscribe"}
          </Button>
        </div>
      </div>

      <Tabs
        selectedKey={view}
        onSelectionChange={onViewChange}
        style={styles.tabs}
      >
        <div {...stylex.props(styles.tabBar)}>
          <div {...stylex.props(styles.tabBarInner)}>
            <TabList aria-label="Labeler views" style={styles.tabList}>
              <Tab id="labels">Labels</Tab>
              <Tab id="documents">Documents</Tab>
            </TabList>
          </div>
          <div {...stylex.props(styles.tabRule)} aria-hidden />
        </div>

        <ReaderContent>
          <TabPanel id="labels" style={styles.tabPanel}>
            <div {...stylex.props(styles.settingGroup)}>
              {defs.length === 0 ? (
                <p {...stylex.props(styles.note)}>
                  This labeler didn’t publish any label definitions.
                </p>
              ) : (
                defs.map((def) => {
                  const val = def.identifier ?? defName(def);
                  const current =
                    prefs.get(val) ??
                    (def.defaultSetting as Visibility) ??
                    "warn";
                  return (
                    <div key={val} {...stylex.props(styles.labelRow)}>
                      <div {...stylex.props(styles.labelText)}>
                        <p {...stylex.props(styles.labelName)}>
                          {defName(def)}
                        </p>
                        {defDescription(def) ? (
                          <p {...stylex.props(styles.labelDescription)}>
                            {defDescription(def)}
                          </p>
                        ) : null}
                      </div>
                      <SegmentedControl
                        selectedKeys={new Set([current])}
                        isDisabled={!subscribed || setPref.isPending}
                        onSelectionChange={(keys) => {
                          const key = String([...keys][0] ?? "");
                          if (
                            key === "ignore" ||
                            key === "warn" ||
                            key === "hide"
                          ) {
                            setPref.mutate({
                              labeler: card.did,
                              val,
                              visibility: key,
                            });
                          }
                        }}
                      >
                        {VISIBILITY_OPTIONS.map((opt) => (
                          <SegmentedControlItem key={opt.id} id={opt.id}>
                            {opt.label}
                          </SegmentedControlItem>
                        ))}
                      </SegmentedControl>
                    </div>
                  );
                })
              )}
              {!subscribed && defs.length > 0 ? (
                <p {...stylex.props(styles.note)}>
                  Subscribe to choose how these labels are applied while you
                  read.
                </p>
              ) : null}
            </div>
          </TabPanel>

          <TabPanel id="documents" style={styles.tabPanel}>
            {labeled.isLoading ? (
              <p {...stylex.props(styles.emptyNote)}>Loading…</p>
            ) : documents.length === 0 ? (
              <EmptyState>
                <EmptyStateTitle>Nothing labeled yet</EmptyStateTitle>
                <EmptyStateDescription>
                  This labeler hasn’t labeled any documents in the read-model
                  yet.
                </EmptyStateDescription>
              </EmptyState>
            ) : (
              <div>
                {documents.map((article, index) => (
                  <ArticleRow
                    key={article.uri}
                    article={article}
                    isFirstInSection={index === 0}
                    unread={trackReading && !article.isRead}
                    showSaveButton={false}
                    metaLabels={(labelsByUri[article.uri] ?? []).map((val) =>
                      labelValDisplayName(defs, val),
                    )}
                  />
                ))}
              </div>
            )}
          </TabPanel>
        </ReaderContent>
      </Tabs>
    </div>
  );
}

const styles = stylex.create({
  heroInner: {
    alignItems: "flex-start",
    boxSizing: "border-box",
    columnGap: spacing["5"],
    display: "flex",
    flexWrap: "wrap",
    rowGap: spacing["4"],
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "1320px",
    paddingBottom: spacing["0"],
    paddingLeft: {
      default: spacing["5"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    paddingRight: {
      default: spacing["5"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    paddingTop: spacing["6"],
    width: "100%",
  },
  avRing: {
    flexShrink: 0,
  },
  avatar: {
    height: boxSize["6xl"],
    width: boxSize["6xl"],
  },
  heroInfo: {
    flexBasis: "0%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: "240px",
    paddingTop: spacing["0.5"],
  },
  heroName: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: { default: "1.85rem", "@media (min-width: 48rem)": "2rem" },
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.xs,
    marginBottom: spacing["0"],
    marginTop: spacing["2"],
  },
  heroDesc: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.sm,
    marginBottom: spacing["0"],
    marginTop: spacing["2"],
    maxWidth: "60ch",
  },
  stats: {
    alignItems: "baseline",
    color: uiColor.text1,
    columnGap: spacing["6"],
    display: "flex",
    flexWrap: "wrap",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    rowGap: spacing["2"],
    marginTop: spacing["4"],
  },
  statValue: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginRight: spacing["1"],
  },
  did: {
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  heroActs: {
    alignItems: "center",
    columnGap: spacing["1.5"],
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    rowGap: spacing["2.5"],
    paddingTop: spacing["1"],
  },
  tabs: {
    paddingBottom: spacing["10"],
  },
  tabBar: {
    width: "100%",
  },
  tabBarInner: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "1320px",
    paddingLeft: {
      default: spacing["5"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    paddingRight: {
      default: spacing["5"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    paddingTop: spacing["4"],
    width: "100%",
  },
  tabList: {
    borderBottomStyle: "none",
    borderBottomWidth: 0,
  },
  tabRule: {
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    width: "100%",
  },
  tabPanel: {
    paddingLeft: spacing["0"],
    paddingRight: spacing["0"],
    paddingTop: spacing["6"],
  },
  settingGroup: {
    padding: spacing["5"],
    borderColor: uiColor.border1,
    borderRadius: spacing["3"],
    borderStyle: "solid",
    borderWidth: spacing.px,
    gap: gap["2xl"],
    display: "flex",
    flexDirection: "column",
  },
  labelRow: {
    gap: gap.xl,
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
  },
  labelText: {
    flexGrow: 1,
    minWidth: 0,
  },
  labelName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  labelDescription: {
    color: uiColor.text1,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.base,
    marginTop: spacing["1.5"],
  },
  note: {
    color: uiColor.text1,
    fontSize: fontSize.sm,
  },
  emptyNote: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontStyle: "italic",
    textAlign: "center",
    paddingBottom: spacing["8"],
    paddingTop: spacing["8"],
  },
});
