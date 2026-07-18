"use client";

import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Eye,
  EyeOff,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  Rss,
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { feedApi } from "#/integrations/tanstack-query/api-feed.functions";
import type { ListOwner } from "#/integrations/tanstack-query/api-lists.functions";
import { listApi } from "#/integrations/tanstack-query/api-lists.functions";
import type {
  ArticleCard,
  PublicationCard,
} from "#/integrations/tanstack-query/api-shapes";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { HIDE_READ_STORAGE_KEY } from "#/lib/hide-read";
import { shareLinkUrl, useNativeShareAvailable } from "#/lib/native-share";
import { getPublicUrlClient } from "#/lib/public-url";
import { buildBlueskyComposeUrl } from "#/lib/quote-share";
import {
  listFeedUrl,
  listOgImageUrl,
  siteSocialMeta,
} from "#/lib/site-metadata";
import { usePersistentToggle } from "#/lib/use-persistent-toggle";
import { useTrackReadingHistory } from "#/lib/use-track-reading-history";

import { AuthorProfileLink } from "../components/reader/author-profile-link";
import { useInfiniteScrollSentinel } from "../components/reader/use-infinite-scroll-sentinel";
import { ArticleRow, PubDirectoryRow } from "../components/reader/cards";
import { initials } from "../components/reader/format";
import { ListEditModal } from "../components/reader/list-edit-modal";
import { Handle, Kicker, ReaderContent } from "../components/reader/primitives";
import { isArticleUnreadForReader } from "../components/reader/read-optimistic";
import { RssFeedButton } from "../components/reader/rss-feed-button";
import { ShareMenu } from "../components/reader/share-menu";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Avatar } from "../design-system/avatar";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem } from "../design-system/menu";
import { Tab, TabList, TabPanel, Tabs } from "../design-system/tabs";
import { uiColor } from "../design-system/theme/color.stylex";
import { spacing } from "../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../design-system/theme/typography.stylex";
import { encodeIssueIds } from "../magazine/issue-link";

const PAGE_SIZE = 20;

/** How many of the most recent renderable articles a magazine edition pins. */
const MAGAZINE_LIMIT = 12;

/** Below this width the hero actions collapse into a single overflow menu. */
const HERO_DESKTOP = "@media (min-width: 40rem)";

const listSearchSchema = z.object({
  view: z.enum(["feed", "publications", "users"]).default("feed"),
});

type ListView = z.infer<typeof listSearchSchema>["view"];

export const Route = createFileRoute("/_layout/l/$did/$rkey")({
  validateSearch: listSearchSchema,
  loader: async ({ context, params }) => {
    const page = await context.queryClient.ensureQueryData(
      listApi.getListQueryOptions(params.did, params.rkey),
    );
    await context.queryClient.ensureQueryData(
      listApi.getListFeedQueryOptions(params.did, params.rkey, {
        limit: PAGE_SIZE,
        offset: 0,
      }),
    );
    return {
      listName: page.list?.name ?? null,
      listDescription: page.list?.description ?? null,
      ownerHandle: page.owner?.handle ?? null,
    };
  },
  head: ({ loaderData, match, params }) => {
    const name = loaderData?.listName;
    if (!name) {
      return { meta: [{ title: "Standard Reader" }] };
    }
    const baseUrl = getPublicUrlClient();
    const owner = loaderData?.ownerHandle;
    return {
      meta: siteSocialMeta({
        title: `${name} · Standard Reader`,
        description:
          loaderData?.listDescription?.trim() ||
          `A publication list${owner ? ` by @${owner}` : ""} on Standard Reader.`,
        url: `${baseUrl}${match.pathname}`,
        ogImage: listOgImageUrl(baseUrl, params.did, params.rkey),
      }),
      links: [
        {
          rel: "alternate",
          type: "application/rss+xml",
          title: `${name} · Standard Reader`,
          href: listFeedUrl(baseUrl, params.did, params.rkey),
        },
      ],
    };
  },
  component: ListPage,
});

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
  handleLink: {
    textDecoration: { default: "none", ":hover": "underline" },
    color: "inherit",
    textDecorationColor: "currentColor",
    textUnderlineOffset: "2px",
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
  heroActs: {
    alignItems: "center",
    columnGap: spacing["1.5"],
    display: { default: "none", [HERO_DESKTOP]: "flex" },
    flexWrap: "wrap",
    justifyContent: "flex-end",
    rowGap: spacing["2.5"],
    paddingTop: spacing["1"],
  },
  heroActsMobile: {
    alignItems: "center",
    display: { default: "flex", [HERO_DESKTOP]: "none" },
    flexShrink: 0,
    justifyContent: "flex-end",
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
  emptyNote: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontStyle: "italic",
    textAlign: "center",
    paddingBottom: spacing["8"],
    paddingTop: spacing["8"],
  },
  userRow: {
    alignItems: "center",
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    columnGap: spacing["3"],
    display: "flex",
    paddingBottom: spacing["3"],
    paddingTop: spacing["3"],
  },
  userRowFirst: {
    borderTopWidth: 0,
    paddingTop: spacing["0"],
  },
  userAvatar: {
    flexShrink: 0,
  },
  userLink: {
    color: "inherit",
    textDecoration: { default: "none", ":hover": "underline" },
  },
  userName: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  userHandle: {
    marginTop: spacing["0.5"],
  },
  loadSentinel: {
    height: 1,
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
});

function ListFeedPanel({
  did,
  rkey,
  hasMembers,
  isOwner,
  hideRead,
}: {
  did: string;
  rkey: string;
  hasMembers: boolean;
  isOwner: boolean;
  hideRead: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);
  const { enabled: trackReading } = useTrackReadingHistory();

  const { data: feed } = useSuspenseQuery(
    listApi.getListFeedQueryOptions(did, rkey, {
      limit: PAGE_SIZE,
      offset: 0,
    }),
  );

  const [items, setItems] = useState<Array<ArticleCard>>(() => feed.items);
  const [nextOffset, setNextOffset] = useState<number | null>(
    () => feed.nextOffset,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setItems(feed.items);
    setNextOffset(feed.nextOffset);
  }, [feed]);

  const loadMore = useCallback(async () => {
    if (nextOffset == null || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listApi.getListFeed({
        data: { did, rkey, limit: PAGE_SIZE, offset: nextOffset },
      });
      setItems((prev) => {
        const seen = new Set(prev.map((article) => article.uri));
        return [
          ...prev,
          ...page.items.filter((article) => !seen.has(article.uri)),
        ];
      });
      setNextOffset(page.nextOffset);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [did, nextOffset, rkey]);

  const loadMoreSentinelRef = useInfiniteScrollSentinel(
    loadMore,
    nextOffset != null,
    nextOffset ?? 0,
  );

  if (!hasMembers) {
    return (
      <div {...stylex.props(styles.emptyNote)}>
        This list is empty
        {isOwner ? " — add publications or people to it." : "."}
      </div>
    );
  }

  // Cache-aware so a just-read article's dot clears (and it hides under "hide
  // read") the moment it's optimistically marked read, before the list refetches.
  const isUnread = (article: ArticleCard) =>
    isArticleUnreadForReader(queryClient, article, { trackReading, signedIn });
  const canFilterRead = hideRead && trackReading && signedIn;
  const visibleItems = canFilterRead
    ? items.filter((article) => isUnread(article))
    : items;

  if (items.length === 0) {
    return (
      <div {...stylex.props(styles.emptyNote)}>
        No articles from this list&apos;s publications or people yet.
      </div>
    );
  }

  if (visibleItems.length === 0) {
    return (
      <div {...stylex.props(styles.emptyNote)}>
        You&apos;ve read every article here. Show read articles to see them
        again.
      </div>
    );
  }

  return (
    <>
      <div>
        {visibleItems.map((article, index) => (
          <ArticleRow
            key={article.uri}
            article={article}
            isFirstInSection={index === 0}
            unread={isUnread(article)}
            showSaveButton={false}
          />
        ))}
      </div>
      {nextOffset == null ? (
        <p {...stylex.props(styles.endNote)}>You&apos;ve reached the end.</p>
      ) : (
        <>
          <div
            ref={loadMoreSentinelRef}
            aria-hidden
            {...stylex.props(styles.loadSentinel)}
          />
          {loadingMore ? (
            <p {...stylex.props(styles.endNote)}>Loading…</p>
          ) : null}
        </>
      )}
    </>
  );
}

function ListPublicationsPanel({
  publications,
  isOwner,
}: {
  publications: Array<PublicationCard>;
  isOwner: boolean;
}) {
  if (publications.length === 0) {
    return (
      <div {...stylex.props(styles.emptyNote)}>
        No publications in this list
        {isOwner ? " — add some from the edit dialog." : "."}
      </div>
    );
  }

  return (
    <div>
      {publications.map((pub, index) => (
        <PubDirectoryRow
          key={pub.uri}
          pub={pub}
          rank={index + 1}
          isFirstInSection={index === 0}
          isLast={index === publications.length - 1}
        />
      ))}
    </div>
  );
}

function ListPeoplePanel({
  users,
  isOwner,
}: {
  users: Array<ListOwner>;
  isOwner: boolean;
}) {
  if (users.length === 0) {
    return (
      <div {...stylex.props(styles.emptyNote)}>
        No people in this list
        {isOwner ? " — add some from the edit dialog." : "."}
      </div>
    );
  }

  return (
    <div>
      {users.map((member, index) => {
        const name = member.displayName?.trim() || member.handle || member.did;
        return (
          <div
            key={member.did}
            {...stylex.props(
              styles.userRow,
              index === 0 && styles.userRowFirst,
            )}
          >
            <AuthorProfileLink
              authorRef={member.did}
              linkStyle={styles.userLink}
            >
              <Avatar
                size="md"
                src={member.avatarUrl ?? undefined}
                fallback={initials(name)}
                alt={name}
                style={styles.userAvatar}
              />
            </AuthorProfileLink>
            <div>
              <AuthorProfileLink
                authorRef={member.did}
                linkStyle={styles.userLink}
              >
                <span {...stylex.props(styles.userName)}>{name}</span>
              </AuthorProfileLink>
              {member.handle ? (
                <div>
                  <Handle style={styles.userHandle}>@{member.handle}</Handle>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListPage() {
  const { did, rkey } = Route.useParams();
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { data: page } = useSuspenseQuery(
    listApi.getListQueryOptions(did, rkey),
  );
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);
  const { enabled: trackReading } = useTrackReadingHistory();
  const nativeShareAvailable = useNativeShareAvailable();
  const { data: sidebar } = useQuery(feedApi.getSidebarQueryOptions());
  const following = sidebar?.following ?? [];
  const followingUsers = sidebar?.followingUsers ?? [];

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rssOpen, setRssOpen] = useState(false);
  const [hideRead, setHideRead] = usePersistentToggle(HIDE_READ_STORAGE_KEY);

  // Snapshot the current top-of-feed articles so the magazine link is stable:
  // the chosen articles are baked into the URL and won't drift as the list grows.
  const { data: feedForMagazine } = useQuery(
    listApi.getListFeedQueryOptions(did, rkey, {
      limit: PAGE_SIZE,
      offset: 0,
    }),
  );
  const magazineArticles = (feedForMagazine?.items ?? [])
    .filter((item) => item.hasRenderableBody)
    .slice(0, MAGAZINE_LIMIT);
  const openMagazine = () => {
    void navigate({
      to: "/collection/$did/$rkey",
      params: { did, rkey },
      search: { ids: encodeIssueIds(magazineArticles) },
    });
  };

  const invalidateListQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["list", did, rkey] });
    void queryClient.invalidateQueries({ queryKey: ["list"] });
    void queryClient.invalidateQueries({ queryKey: ["reader", "lists"] });
    void queryClient.invalidateQueries({
      queryKey: ["reader", "savedLists"],
    });
    // Saving a list acts like following its publications, so every feed
    // surface (sidebar, home, latest) changes too.
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  };

  const leaveAfterDelete = () => {
    void navigate({ to: "/" });
  };

  const deleteMutation = useMutation({
    ...listApi.deleteListMutationOptions(),
    onSuccess: () => {
      setDeleteOpen(false);
      leaveAfterDelete();
    },
    onSettled: invalidateListQueries,
  });
  const saveMutation = useMutation({
    ...listApi.saveListMutationOptions(),
    onSettled: invalidateListQueries,
  });
  const unsaveMutation = useMutation({
    ...listApi.unsaveListMutationOptions(),
    onSettled: invalidateListQueries,
  });
  const toggling = saveMutation.isPending || unsaveMutation.isPending;

  const onViewChange = (key: React.Key) => {
    const next = key as ListView;
    void navigate({ search: { view: next } });
  };

  if (!page.list) {
    return (
      <ReaderContent>
        <div {...stylex.props(styles.emptyNote)}>
          We couldn’t find that list.
        </div>
      </ReaderContent>
    );
  }

  const { list, owner, publications, users, viewer } = page;

  const hasPublications = list.publications.length > 0;
  const hasUsers = list.users.length > 0;
  // Only Articles + the populated member tabs are shown; if the URL points at a
  // tab this list doesn't have, fall back to Articles.
  const selectedView =
    (view === "publications" && !hasPublications) ||
    (view === "users" && !hasUsers)
      ? "feed"
      : view;

  const pageUrl = `${getPublicUrlClient()}/l/${did}/${rkey}`;
  const feedUrl = listFeedUrl(getPublicUrlClient(), did, rkey);
  const showMagazine = magazineArticles.length > 0;
  // Filtering read articles only makes sense once reading history is tracked.
  const showReadToggle = signedIn && trackReading;
  const readToggleLabel = hideRead
    ? "Show read articles"
    : "Hide read articles";

  const toggleHideRead = () => setHideRead((value: boolean) => !value);
  const onCopyLink = () => {
    void navigator.clipboard.writeText(pageUrl);
  };
  const onShareBluesky = () => {
    globalThis.open(
      buildBlueskyComposeUrl(pageUrl),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div>
      <div {...stylex.props(styles.heroInner)}>
        <div {...stylex.props(styles.heroInfo)}>
          <Kicker>Publication list</Kicker>
          <h1 {...stylex.props(styles.heroName)}>{list.name}</h1>
          {list.description ? (
            <p {...stylex.props(styles.heroDesc)}>{list.description}</p>
          ) : null}
          <div {...stylex.props(styles.stats)}>
            {owner?.handle ? (
              <Link
                to="/u/$did"
                params={{ did: owner.did }}
                {...stylex.props(styles.handleLink)}
              >
                <Handle>by @{owner.handle}</Handle>
              </Link>
            ) : null}
            {list.publications.length > 0 ? (
              <span>
                <span {...stylex.props(styles.statValue)}>
                  {list.publications.length}
                </span>
                {list.publications.length === 1
                  ? "publication"
                  : "publications"}
              </span>
            ) : null}
            {list.users.length > 0 ? (
              <span>
                <span {...stylex.props(styles.statValue)}>
                  {list.users.length}
                </span>
                {list.users.length === 1 ? "user" : "users"}
              </span>
            ) : null}
          </div>
        </div>

        <div {...stylex.props(styles.heroActs)}>
          {showMagazine ? (
            <IconButton
              variant="secondary"
              size="lg"
              label="Read as magazine"
              onPress={openMagazine}
            >
              <BookOpen size={18} />
            </IconButton>
          ) : null}
          {showReadToggle ? (
            <IconButton
              variant={hideRead ? "primary" : "secondary"}
              size="lg"
              label={readToggleLabel}
              onPress={toggleHideRead}
            >
              {hideRead ? <EyeOff size={18} /> : <Eye size={18} />}
            </IconButton>
          ) : null}
          <ShareMenu pageUrl={pageUrl} variant="icon" size="lg" />
          <RssFeedButton
            name={list.name}
            feedUrl={feedUrl}
            size="lg"
            isOpen={rssOpen}
            onOpenChange={setRssOpen}
          />
          {viewer.isOwner ? (
            <>
              <IconButton
                variant="secondary"
                size="lg"
                label="Edit list"
                onPress={() => setEditOpen(true)}
              >
                <Pencil size={18} />
              </IconButton>
              <IconButton
                variant="critical-outline"
                size="lg"
                label="Delete list"
                onPress={() => setDeleteOpen(true)}
              >
                <Trash2 size={18} />
              </IconButton>
            </>
          ) : signedIn ? (
            viewer.isSaved ? (
              <IconButton
                variant="secondary"
                size="lg"
                label="Remove list"
                isPending={toggling}
                onPress={() => unsaveMutation.mutate(list.uri)}
              >
                <BookmarkCheck size={18} />
              </IconButton>
            ) : (
              <IconButton
                variant="primary"
                size="lg"
                label="Subscribe to list"
                isPending={toggling}
                onPress={() => saveMutation.mutate(list.uri)}
              >
                <BookmarkPlus size={18} />
              </IconButton>
            )
          ) : null}
        </div>

        <div {...stylex.props(styles.heroActsMobile)}>
          <Menu
            trigger={
              <IconButton variant="secondary" size="lg" label="More actions">
                <MoreHorizontal size={18} />
              </IconButton>
            }
          >
            {showMagazine ? (
              <MenuItem onPress={openMagazine} suffix={<BookOpen size={14} />}>
                Read as magazine
              </MenuItem>
            ) : null}
            {showReadToggle ? (
              <MenuItem
                onPress={toggleHideRead}
                suffix={hideRead ? <EyeOff size={14} /> : <Eye size={14} />}
              >
                {readToggleLabel}
              </MenuItem>
            ) : null}
            <MenuItem onPress={onCopyLink} suffix={<LinkIcon size={14} />}>
              Copy link
            </MenuItem>
            <MenuItem onPress={onShareBluesky} suffix={<Share2 size={14} />}>
              Share on Bluesky
            </MenuItem>
            {nativeShareAvailable ? (
              <MenuItem
                onPress={() => {
                  void shareLinkUrl(pageUrl);
                }}
              >
                Share elsewhere
              </MenuItem>
            ) : null}
            <MenuItem
              onPress={() => setRssOpen(true)}
              suffix={<Rss size={14} />}
            >
              RSS feed
            </MenuItem>
            {viewer.isOwner ? (
              <>
                <MenuItem
                  onPress={() => setEditOpen(true)}
                  suffix={<Pencil size={14} />}
                >
                  Edit list
                </MenuItem>
                <MenuItem
                  variant="destructive"
                  onPress={() => setDeleteOpen(true)}
                  suffix={<Trash2 size={14} />}
                >
                  Delete list
                </MenuItem>
              </>
            ) : signedIn ? (
              viewer.isSaved ? (
                <MenuItem
                  onPress={() => unsaveMutation.mutate(list.uri)}
                  suffix={<BookmarkCheck size={14} />}
                >
                  Remove list
                </MenuItem>
              ) : (
                <MenuItem
                  onPress={() => saveMutation.mutate(list.uri)}
                  suffix={<BookmarkPlus size={14} />}
                >
                  Subscribe to list
                </MenuItem>
              )
            ) : null}
          </Menu>
        </div>
      </div>

      <Tabs
        selectedKey={selectedView}
        onSelectionChange={onViewChange}
        style={styles.tabs}
      >
        <div {...stylex.props(styles.tabBar)}>
          <div {...stylex.props(styles.tabBarInner)}>
            <TabList aria-label="List views" style={styles.tabList}>
              <Tab id="feed">Articles</Tab>
              {hasPublications ? (
                <Tab id="publications">Publications</Tab>
              ) : null}
              {hasUsers ? <Tab id="users">Users</Tab> : null}
            </TabList>
          </div>
          <div {...stylex.props(styles.tabRule)} aria-hidden />
        </div>

        <ReaderContent>
          <TabPanel id="feed" style={styles.tabPanel}>
            <ListFeedPanel
              did={did}
              rkey={rkey}
              hasMembers={hasPublications || hasUsers}
              isOwner={viewer.isOwner}
              hideRead={hideRead}
            />
          </TabPanel>
          {hasPublications ? (
            <TabPanel id="publications" style={styles.tabPanel}>
              <ListPublicationsPanel
                publications={publications}
                isOwner={viewer.isOwner}
              />
            </TabPanel>
          ) : null}
          {hasUsers ? (
            <TabPanel id="users" style={styles.tabPanel}>
              <ListPeoplePanel users={users} isOwner={viewer.isOwner} />
            </TabPanel>
          ) : null}
        </ReaderContent>
      </Tabs>

      {viewer.isOwner ? (
        <>
          <ListEditModal
            isOpen={editOpen}
            onOpenChange={setEditOpen}
            list={list}
            following={following}
            followingUsers={followingUsers}
            onDeleted={leaveAfterDelete}
          />
          <AlertDialog
            isOpen={deleteOpen}
            onOpenChange={setDeleteOpen}
            trigger={<span hidden aria-hidden />}
          >
            <AlertDialogHeader>Delete list?</AlertDialogHeader>
            <AlertDialogDescription>
              “{list.name}” will be removed from your account. Anyone who saved
              it will no longer see it in their sidebar. This can’t be undone.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancelButton isDisabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancelButton>
              <AlertDialogActionButton
                variant="critical"
                closeOnPress={false}
                isPending={deleteMutation.isPending}
                onPress={() => deleteMutation.mutate(rkey)}
              >
                Delete list
              </AlertDialogActionButton>
            </AlertDialogFooter>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
