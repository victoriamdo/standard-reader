"use client";

import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { discoverApi } from "#/integrations/tanstack-query/api-discover.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import {
  Compass,
  Flame,
  LayoutGrid,
  List,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { PublicationCard } from "../integrations/tanstack-query/api-shapes";

import { PubCard, PubDirectoryRow } from "../components/reader/cards";
import { sortDiscoverTopics } from "../components/reader/discover-topics";
import {
  Masthead,
  ReaderContent,
  SectionDivider,
  SectionHead,
} from "../components/reader/primitives";
import { Button } from "../design-system/button";
import { Grid } from "../design-system/grid";
import { SearchField } from "../design-system/search-field";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { Tag, TagGroup } from "../design-system/tag-group";
import { uiColor } from "../design-system/theme/color.stylex";
import { gap } from "../design-system/theme/semantic-spacing.stylex";
import { spacing } from "../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  lineHeight,
} from "../design-system/theme/typography.stylex";

const DIRECTORY_PAGE_SIZE = 24;
const RAIL_LIMIT = 10;
const SOCIAL_PROOF_LIMIT = 3;

const discoverSearchSchema = z.object({
  topic: z.string().optional(),
  sort: z.enum(["readers", "active", "az"]).default("readers"),
  view: z.enum(["grid", "list"]).default("list"),
});

export const Route = createFileRoute("/_layout/discover")({
  validateSearch: discoverSearchSchema,
  loaderDeps: ({ search }) => ({
    topic: search.topic ?? null,
    sort: search.sort,
  }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(discoverApi.getTopicsQueryOptions()),
      context.queryClient.ensureQueryData(
        discoverApi.getRecommendedPublicationsQueryOptions({
          limit: RAIL_LIMIT,
        }),
      ),
      context.queryClient.ensureQueryData(
        discoverApi.getFollowedByPeopleYouFollowQueryOptions({
          limit: RAIL_LIMIT,
        }),
      ),
      context.queryClient.ensureQueryData(
        discoverApi.getTrendingPublicationsQueryOptions({ limit: RAIL_LIMIT }),
      ),
      context.queryClient.ensureQueryData(
        discoverApi.getPublicationsQueryOptions({
          topic: deps.topic,
          sort: deps.sort,
          limit: DIRECTORY_PAGE_SIZE,
          offset: 0,
        }),
      ),
    ]);
  },
  component: Discover,
});

const styles = stylex.create({
  section: {
    marginBottom: spacing["12"],
  },
  railWrap: {
    marginTop: spacing["5"],
  },
  railScroll: {
    alignItems: "stretch",
    columnGap: gap["lg"],
    display: "grid",
    gridAutoColumns: "300px",
    gridAutoFlow: "column",
    marginTop: `calc(${spacing["3"]} * -1)`,
    overflowX: "auto",
    paddingBottom: spacing["2"],
    paddingTop: spacing["3"],
    rowGap: gap["lg"],
    scrollSnapType: "x mandatory",
    // eslint-disable-next-line @stylexjs/valid-styles
    scrollbarWidth: "thin",
  },
  socialGrid: {
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    marginTop: spacing["5"],
  },
  directorySearch: {
    marginBottom: spacing["5"],
    marginTop: spacing["5"],
    maxWidth: "28rem",
  },
  directoryToolbar: {
    alignItems: "center",
    columnGap: spacing["4"],
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing["4"],
    marginBottom: spacing["6"],
  },
  directoryGrid: {
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  },
  loadMore: {
    marginTop: spacing["6"],
    width: "100%",
  },
  endNote: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.sm,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: spacing["6"],
  },
  emptyRail: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontStyle: "italic",
    lineHeight: lineHeight.sm,
    marginTop: spacing["4"],
  },
  kickerIcon: {
    height: spacing["3.5"],
    width: spacing["3.5"],
  },
});

const SORT_OPTIONS = [
  { id: "readers", label: "Readers" },
  { id: "active", label: "Active" },
  { id: "az", label: "A–Z" },
] as const;

function SectionIcon({ children }: { children: React.ReactNode }) {
  return <span {...stylex.props(styles.kickerIcon)}>{children}</span>;
}

function HorizontalRail({ pubs }: { pubs: Array<PublicationCard> }) {
  return (
    <div {...stylex.props(styles.railWrap)}>
      <div {...stylex.props(styles.railScroll)}>
        {pubs.map((pub) => (
          <PubCard key={pub.uri} pub={pub} rail />
        ))}
      </div>
    </div>
  );
}

function matchesDirectorySearch(pub: PublicationCard, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [pub.name, pub.ownerHandle, pub.description, pub.topic]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function Discover() {
  const { topic, sort, view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [directoryItems, setDirectoryItems] = useState<Array<PublicationCard>>(
    [],
  );
  const [directoryNextOffset, setDirectoryNextOffset] = useState<number | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: topics } = useSuspenseQuery(
    discoverApi.getTopicsQueryOptions(),
  );
  const { data: recommended } = useSuspenseQuery(
    discoverApi.getRecommendedPublicationsQueryOptions({ limit: RAIL_LIMIT }),
  );
  const { data: followedBy } = useSuspenseQuery(
    discoverApi.getFollowedByPeopleYouFollowQueryOptions({ limit: RAIL_LIMIT }),
  );
  const { data: trending } = useSuspenseQuery(
    discoverApi.getTrendingPublicationsQueryOptions({ limit: RAIL_LIMIT }),
  );
  const { data: directory } = useSuspenseQuery(
    discoverApi.getPublicationsQueryOptions({
      topic: topic ?? null,
      sort,
      limit: DIRECTORY_PAGE_SIZE,
      offset: 0,
    }),
  );

  useEffect(() => {
    setDirectoryItems(directory.items);
    setDirectoryNextOffset(directory.nextOffset);
    setSearchQuery("");
  }, [directory]);

  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);

  const topicKey = topic ?? "all";
  const topicItems = useMemo(() => sortDiscoverTopics(topics), [topics]);
  const knownPublicationCount = useMemo(
    () => topics.reduce((sum, chip) => sum + chip.count, 0),
    [topics],
  );

  const filteredDirectoryItems = useMemo(
    () =>
      directoryItems.filter((pub) => matchesDirectorySearch(pub, searchQuery)),
    [directoryItems, searchQuery],
  );

  const onTopicChange = (keys: Set<React.Key> | "all") => {
    const id = keys === "all" ? "all" : String([...keys][0]);
    void navigate({
      search: (prev) => ({
        ...prev,
        topic: id === "all" ? undefined : id,
      }),
    });
  };

  const onSortChange = (keys: Set<React.Key> | "all") => {
    const next =
      keys === "all"
        ? "readers"
        : (String([...keys][0]) as "readers" | "active" | "az");
    void navigate({
      search: (prev) => ({
        ...prev,
        sort: next,
      }),
    });
  };

  const onViewChange = (keys: Set<React.Key> | "all") => {
    const next = keys === "all" ? "list" : ([...keys][0] as "grid" | "list");
    void navigate({ search: (prev) => ({ ...prev, view: next }) });
  };

  const onLoadMore = async () => {
    if (directoryNextOffset == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await discoverApi.getPublications({
        data: {
          topic: topic ?? null,
          sort,
          limit: DIRECTORY_PAGE_SIZE,
          offset: directoryNextOffset,
        },
      });
      setDirectoryItems((prev) => [...prev, ...page.items]);
      setDirectoryNextOffset(page.nextOffset);
    } finally {
      setLoadingMore(false);
    }
  };

  const recommendedKicker = signedIn
    ? "Tuned to your follows"
    : "Established reads";
  const recommendedTitle = signedIn ? "Recommended for you" : "Recommended";

  return (
    <ReaderContent>
      <Masthead
        kicker="The directory"
        kickerIcon={<Compass size={13} />}
        title="Discover"
        dek={
          knownPublicationCount > 0
            ? `Every publication the network knows about — ${knownPublicationCount} and counting. Follow the ones worth your mornings.`
            : "Every publication the network knows about — follow the ones worth your mornings."
        }
        metaLabel="Known publications"
        metaValue={
          knownPublicationCount > 0 ? knownPublicationCount : undefined
        }
      />

      <div {...stylex.props(styles.section)}>
        <SectionHead
          kicker={recommendedKicker}
          title={recommendedTitle}
          icon={
            <SectionIcon>
              <Sparkles size={13} />
            </SectionIcon>
          }
        />
        {recommended.length > 0 ? (
          <HorizontalRail pubs={recommended} />
        ) : (
          <p {...stylex.props(styles.emptyRail)}>
            Follow a few publications to unlock recommendations.
          </p>
        )}
      </div>

      {signedIn ? (
        <div {...stylex.props(styles.section)}>
          <SectionHead
            kicker="Social proof"
            title="Followed by people you follow"
            icon={
              <SectionIcon>
                <Users size={13} />
              </SectionIcon>
            }
          />
          {followedBy.length > 0 ? (
            <Grid columnGap="lg" rowGap="lg" style={styles.socialGrid}>
              {followedBy.slice(0, SOCIAL_PROOF_LIMIT).map((pub) => (
                <PubCard key={pub.uri} pub={pub} />
              ))}
            </Grid>
          ) : (
            <p {...stylex.props(styles.emptyRail)}>
              Follow more publications to see what similar readers subscribe to.
            </p>
          )}
        </div>
      ) : null}

      <div {...stylex.props(styles.section)}>
        <SectionHead
          kicker="Most active this week"
          title="Trending publications"
          icon={
            <SectionIcon>
              <Flame size={13} />
            </SectionIcon>
          }
        />
        {trending.length > 0 ? (
          <div>
            {trending.slice(0, 5).map((pub, index) => (
              <PubDirectoryRow
                key={pub.uri}
                pub={pub}
                rank={index + 1}
                isLast={index === Math.min(trending.length, 5) - 1}
              />
            ))}
          </div>
        ) : (
          <p {...stylex.props(styles.emptyRail)}>
            No trending publications yet.
          </p>
        )}
      </div>

      <SectionDivider />

      <div {...stylex.props(styles.section)}>
        <SectionHead kicker="Browse everything" title="All publications" />

        <SearchField
          aria-label="Search publications"
          placeholder="Search by name, handle, or topic…"
          value={searchQuery}
          onChange={setSearchQuery}
          size="sm"
          style={styles.directorySearch}
        />

        <div {...stylex.props(styles.directoryToolbar)}>
          <TagGroup
            selectionMode="single"
            selectedKeys={new Set([topicKey])}
            onSelectionChange={onTopicChange}
            items={topicItems}
          >
            {(item) => <Tag id={item.id}>{item.name}</Tag>}
          </TagGroup>

          <div>
            <SegmentedControl
              selectedKeys={new Set([sort])}
              onSelectionChange={onSortChange}
              size="sm"
            >
              {SORT_OPTIONS.map((option) => (
                <SegmentedControlItem key={option.id} id={option.id}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>

          <SegmentedControl
            selectedKeys={new Set([view])}
            onSelectionChange={onViewChange}
            size="sm"
          >
            <SegmentedControlItem id="list" aria-label="List view">
              <List size={16} />
            </SegmentedControlItem>
            <SegmentedControlItem id="grid" aria-label="Grid view">
              <LayoutGrid size={16} />
            </SegmentedControlItem>
          </SegmentedControl>
        </div>

        {filteredDirectoryItems.length === 0 ? (
          <p {...stylex.props(styles.emptyRail)}>
            {searchQuery.trim()
              ? "No publications match your search."
              : "No publications match this topic yet."}
          </p>
        ) : view === "grid" ? (
          <Grid columnGap="lg" rowGap="lg" style={styles.directoryGrid}>
            {filteredDirectoryItems.map((pub) => (
              <PubCard key={pub.uri} pub={pub} />
            ))}
          </Grid>
        ) : (
          <div>
            {filteredDirectoryItems.map((pub, index) => (
              <PubDirectoryRow
                key={pub.uri}
                pub={pub}
                isLast={index === filteredDirectoryItems.length - 1}
              />
            ))}
          </div>
        )}

        {directoryItems.length > 0 && !searchQuery.trim() ? (
          directoryNextOffset == null ? (
            <p {...stylex.props(styles.endNote)}>
              You&apos;ve reached the end.
            </p>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              style={styles.loadMore}
              onPress={onLoadMore}
              isDisabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )
        ) : null}
      </div>
    </ReaderContent>
  );
}
