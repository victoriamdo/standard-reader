"use client";

import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowBigUp,
  ArrowUp,
  Bug,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  MessageSquarePlus,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";

import { FeedbackDialog } from "#/components/feedback/feedback-dialog";
import { formatRelativeTime, initials } from "#/components/reader/format";
import { ReaderContent } from "#/components/reader/primitives";
import { Avatar } from "#/design-system/avatar";
import { Button } from "#/design-system/button";
import { Flex } from "#/design-system/flex";
import { Link } from "#/design-system/link";
import { SearchField } from "#/design-system/search-field";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "#/design-system/segmented-control";
import { Select, SelectItem } from "#/design-system/select";
import { Skeleton } from "#/design-system/skeleton";
import { animationDuration } from "#/design-system/theme/animations.stylex";
import { primaryColor, uiColor } from "#/design-system/theme/color.stylex";
import { amber } from "#/design-system/theme/colors/amber.stylex";
import { blue } from "#/design-system/theme/colors/blue.stylex";
import { green } from "#/design-system/theme/colors/green.stylex";
import { red } from "#/design-system/theme/colors/red.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import { shadow } from "#/design-system/theme/shadow.stylex";
import { spacing } from "#/design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "#/design-system/theme/typography.stylex";
import { auth } from "#/integrations/tanstack-query/api-auth.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import type { UserinputDiscussion } from "#/integrations/tanstack-query/api-userinput.functions";
import { userinputApi } from "#/integrations/tanstack-query/api-userinput.functions";
import { isAtprotoScopeMissingError } from "#/lib/atproto/scope-error";
import { getPublicUrlClient } from "#/lib/public-url";
import { pageSocialMeta } from "#/lib/site-metadata";
import type { FeedbackTag } from "#/lib/userinput/space";
import { STANDARD_READER_FEEDBACK_TAGS } from "#/lib/userinput/space";
import { parseAtUri } from "#/server/atproto/uri";

export const Route = createFileRoute("/_layout/feedback/")({
  // Non-blocking: prefetch so the masthead below can render immediately (see
  // FeedbackPage) instead of the whole page waiting on this data. The
  // discussions list suspends on its own (see FeedbackDiscussions), showing
  // `DiscussionListSkeleton` while the prefetch is still in flight.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      userinputApi.getFeedbackDiscussionsQueryOptions({ limit: 50 }),
    );
  },
  head: () => ({
    meta: pageSocialMeta("feedback", getPublicUrlClient()),
  }),
  component: FeedbackPage,
  errorComponent: ({ error }) => (
    <Message>
      Could not load feedback{" "}
      <span {...stylex.props(styles.mono)}>
        ({error instanceof Error ? "500" : "error"})
      </span>
      . Try again in a moment.
    </Message>
  ),
});

const TAG_ICON: Record<FeedbackTag, React.ReactNode> = {
  bug: <Bug size={13} strokeWidth={2} />,
  feature: <Lightbulb size={13} strokeWidth={2} />,
  question: <HelpCircle size={13} strokeWidth={2} />,
};

const TAG_LABEL: Record<FeedbackTag, string> = {
  bug: "Bug",
  feature: "Feature request",
  question: "Question",
};

const TAG_SECTION: Record<FeedbackTag, string> = {
  bug: "Bugs",
  feature: "Feature requests",
  question: "Questions",
};

const styles = stylex.create({
  // ── Page ────────────────────────────────────────────────────────────
  // Constrain the feedback page to an article-reading column width so the
  // masthead, toolbar, and cards don't stretch the full ReaderContent
  // (1320px) container — matches the feel of an article page.
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "46rem",
    width: "100%",
  },
  // ── Masthead ───────────────────────────────────────────────────────
  masthead: {
    alignItems: {
      default: "flex-start",
      "@media (min-width: 40rem)": "flex-end",
    },
    borderBottomColor: uiColor.border2,
    borderBottomStyle: "solid",
    borderBottomWidth: 2,
    columnGap: gap["6xl"],
    display: "flex",
    flexDirection: {
      default: "column",
      "@media (min-width: 40rem)": "row",
    },
    justifyContent: "space-between",
    marginBottom: spacing["7"],
    paddingBottom: spacing["6"],
    paddingTop: {
      default: spacing["6"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    rowGap: gap["5xl"],
  },
  title: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: {
      default: "2.4rem",
      "@media (min-width: 48rem)": "3.6rem",
    },
    fontStyle: "italic",
    fontWeight: fontWeight.medium,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.none,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
  },
  dek: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.sm,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    maxWidth: "54ch",
    paddingTop: spacing["3.5"],
  },
  dekLink: {
    color: uiColor.text2,
    textDecorationColor: uiColor.border2,
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textDecorationThickness: "1.5px",
    textUnderlineOffset: "2px",
  },
  submitWrap: {
    flexShrink: 0,
    width: {
      default: "100%",
      "@media (min-width: 40rem)": "auto",
    },
  },
  submitButton: {
    justifyContent: {
      default: "center",
      "@media (min-width: 40rem)": "flex-start",
    },
    width: {
      default: "100%",
      "@media (min-width: 40rem)": "auto",
    },
  },

  // ── Toolbar ────────────────────────────────────────────────────────
  toolbar: {
    alignItems: {
      default: "stretch",
      "@media (min-width: 40rem)": "center",
    },
    columnGap: gap.md,
    display: "flex",
    flexDirection: {
      default: "column",
      "@media (min-width: 40rem)": "row",
    },
    marginBottom: spacing["8"],
    rowGap: gap.md,
  },
  toolbarSearch: {
    flexGrow: 1,
    minWidth: 0,
    width: "100%",
  },
  toolbarSelect: {
    flexShrink: 0,
    flexGrow: {
      default: 1,
      "@media (min-width: 40rem)": 0,
    },
    minWidth: {
      default: 0,
      "@media (min-width: 40rem)": spacing["48"],
    },
    width: {
      default: "100%",
      "@media (min-width: 40rem)": "auto",
    },
  },
  toolbarSort: {
    flexShrink: 0,
  },

  // ── List & sections ────────────────────────────────────────────────
  list: {
    display: "flex",
    flexDirection: "column",
    rowGap: gap.md,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    marginBottom: spacing["9"],
    rowGap: gap["3xl"],
  },
  sectionLast: {
    marginBottom: 0,
  },
  groupHead: {
    alignItems: "center",
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    columnGap: gap["2xl"],
    display: "flex",
    marginBottom: spacing["3.5"],
    paddingBottom: spacing["3"],
  },
  groupHeadTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize["2xl"],
    fontStyle: "italic",
    fontWeight: fontWeight.medium,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
  },
  groupHeadCount: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    marginLeft: "auto",
  },

  // ── Card ───────────────────────────────────────────────────────────
  card: {
    backgroundColor: `light-dark(color-mix(in srgb, ${uiColor.bg} 90%, white), color-mix(in srgb, ${uiColor.bg} 90%, black))`,
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: radius.md,
    cornerShape: "squircle",
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: {
      default: shadow.sm,
      ":hover": shadow.lg,
    },
    display: "flex",
    flexDirection: "column",
    fontFamily: fontFamily.sans,
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["5xl"],
    paddingRight: horizontalSpace["5xl"],
    paddingTop: verticalSpace["3xl"],
    rowGap: gap["2xl"],
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color, box-shadow",
    transitionTimingFunction: "ease-in-out",
    width: "100%",
  },
  cardHead: {
    alignItems: "flex-start",
    columnGap: gap["4xl"],
    display: "flex",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    minWidth: 0,
  },
  headBadges: {
    flexShrink: 0,
  },
  tagPill: {
    alignItems: "center",
    borderRadius: radius.full,
    cornerShape: "squircle",
    columnGap: gap.xs,
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.xs,
    whiteSpace: "nowrap",
  },
  tagBug: {
    backgroundColor: red.component1,
    color: red.text2,
  },
  tagFeature: {
    backgroundColor: amber.component1,
    color: amber.text2,
  },
  tagQuestion: {
    backgroundColor: blue.component1,
    color: blue.text2,
  },
  tagImplemented: {
    backgroundColor: green.component1,
    color: green.text2,
  },
  cardBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.base,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    whiteSpace: "pre-line",
  },
  cardFoot: {
    alignItems: "center",
    columnGap: gap["3xl"],
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: gap["2xl"],
  },
  author: {
    alignItems: "center",
    columnGap: gap.sm,
    display: "flex",
    minWidth: 0,
  },
  authorName: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.sm,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  authorNameAnon: {
    color: uiColor.text1,
    fontStyle: "italic",
  },
  dot: {
    color: uiColor.text1,
    flexShrink: 0,
    fontSize: fontSize.xs,
  },
  when: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
  },
  footRight: {
    alignItems: "center",
    columnGap: gap.xs,
    display: "flex",
    flexShrink: 0,
  },
  openLink: {
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component1,
    },
    borderRadius: radius.sm,
    cornerShape: "squircle",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: gap.xs,
    display: "inline-flex",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.sm,
    paddingRight: horizontalSpace.sm,
    paddingTop: verticalSpace.xs,
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color, color",
    transitionTimingFunction: "ease-in-out",
    "::after": {
      display: "none",
    },
  },
  upvote: {
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": primaryColor.component1,
    },
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: radius.full,
    boxShadow: shadow.xs,
    cornerShape: "squircle",
    borderStyle: "solid",
    borderWidth: 1,
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: gap.xs,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.md,
    paddingTop: verticalSpace.xs,
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color, border-color, color, transform",
    transitionTimingFunction: "ease-in-out",
  },
  upvoteDisabled: {
    cursor: "default",
    opacity: 0.6,
  },
  upvoteActive: {
    backgroundColor: {
      default: primaryColor.component2,
      ":hover": primaryColor.component3,
    },
    borderColor: {
      default: primaryColor.border2,
      ":hover": primaryColor.border3,
    },
    color: primaryColor.text2,
  },
  upvoteIcon: {
    fill: "none",
    transitionDuration: animationDuration.default,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
  },
  upvoteIconActive: {
    color: primaryColor.text2,
    fill: primaryColor.text2,
    transform: "translateY(-1px)",
  },

  // ── Empty / error states ──────────────────────────────────────────
  message: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.xl,
    fontStyle: "italic",
    lineHeight: lineHeight.sm,
    marginBottom: 0,
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: 0,
    maxWidth: "44ch",
    paddingBottom: spacing["20"],
    paddingLeft: spacing["5"],
    paddingRight: spacing["5"],
    paddingTop: spacing["20"],
    textAlign: "center",
  },
  messageEm: {
    color: uiColor.text2,
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontStyle: "normal",
  },

  // ── Skeleton ───────────────────────────────────────────────────────
  skelCard: {
    borderColor: uiColor.border1,
    borderRadius: radius.md,
    cornerShape: "squircle",
    borderStyle: "solid",
    borderWidth: 1,
    display: "flex",
    flexDirection: "column",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["5xl"],
    paddingRight: horizontalSpace["5xl"],
    paddingTop: verticalSpace["3xl"],
    rowGap: gap["2xl"],
  },
  skelHead: {
    alignItems: "center",
    columnGap: gap["4xl"],
    display: "flex",
    justifyContent: "space-between",
  },
  skelFoot: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginTop: spacing["3"],
  },
});

const TAG_PILL_STYLE: Record<FeedbackTag, stylex.StyleXStyles> = {
  bug: styles.tagBug,
  feature: styles.tagFeature,
  question: styles.tagQuestion,
};

function discussionLink(uri: string): string {
  // `app.userinput.discussion` records render on userinput.app under
  // /d/<did>/<rkey> — the SPA extracts just the DID and rkey from the
  // AT-URI (dropping the at:// prefix and collection) and uses them as
  // two path segments. e.g. at://did:plc:abc/app.userinput.discussion/xyz
  //   -> https://userinput.app/#/d/did:plc:abc/xyz
  const parsed = parseAtUri(uri);
  if (!parsed) return "https://userinput.app/#/";
  return `https://userinput.app/#/d/${parsed.did}/${parsed.rkey}`;
}

function tagFor(discussion: UserinputDiscussion): FeedbackTag {
  return (discussion.tags?.[0] ?? "feature") as FeedbackTag;
}

/**
 * Label for a discussion the space owner has marked "implemented" on
 * userinput.app. "Implemented" reads oddly for a question, so questions get
 * "Answered" instead. Returns `null` for every other status (or none).
 */
function implementedLabel(discussion: UserinputDiscussion): string | null {
  if (discussion.status !== "implemented") return null;
  return tagFor(discussion) === "question" ? "Answered" : "Implemented";
}

function DiscussionCard({
  discussion,
  signedIn,
  upvotedUris,
  serverUpvotedUris,
  onUpvote,
}: {
  discussion: UserinputDiscussion;
  signedIn: boolean;
  upvotedUris: Set<string>;
  serverUpvotedUris: Set<string>;
  onUpvote: (discussion: UserinputDiscussion) => void;
}) {
  const tag = tagFor(discussion);
  const statusLabel = implementedLabel(discussion);
  const author = discussion.author;
  const authorName = author.displayName ?? author.handle ?? "Anonymous";
  const isAnon = authorName === "Anonymous";
  const upvoted = upvotedUris.has(discussion.uri);
  // `upvoteCount` is the network total from constellation, which already
  // includes the viewer's upvote when the server seeded `viewerUpvotedUris`.
  // Adjust only for optimistic state the server hasn't reconciled yet:
  //   - optimistic add (locally upvoted, not yet on server): +1
  //   - optimistic remove (locally removed, still on server): -1
  const serverUpvoted = serverUpvotedUris.has(discussion.uri);
  const isOptimisticAdd = upvoted && !serverUpvoted;
  const isOptimisticRemove = !upvoted && serverUpvoted;
  const count = Math.max(
    0,
    discussion.upvoteCount +
      (isOptimisticAdd ? 1 : 0) -
      (isOptimisticRemove ? 1 : 0),
  );
  const title = signedIn
    ? `${count} upvote${count === 1 ? "" : "s"} — click to ${upvoted ? "undo" : "upvote"}`
    : `${count} upvote${count === 1 ? "" : "s"} — sign in to upvote`;
  return (
    <article {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHead)}>
        <h3 {...stylex.props(styles.cardTitle)}>{discussion.title}</h3>
        <Flex align="center" gap="xs" style={styles.headBadges}>
          {statusLabel ? (
            <span {...stylex.props(styles.tagPill, styles.tagImplemented)}>
              <CheckCircle2 size={13} strokeWidth={2} />
              {statusLabel}
            </span>
          ) : (
            <span {...stylex.props(styles.tagPill, TAG_PILL_STYLE[tag])}>
              {TAG_ICON[tag]}
              {TAG_LABEL[tag]}
            </span>
          )}
        </Flex>
      </div>
      {discussion.body ? (
        <p {...stylex.props(styles.cardBody)}>{discussion.body}</p>
      ) : null}
      <div {...stylex.props(styles.cardFoot)}>
        <Flex align="center" gap="sm" style={styles.author}>
          <Avatar
            size="sm"
            src={author.avatar ?? undefined}
            fallback={initials(authorName)}
            alt={authorName}
          />
          <span
            {...stylex.props(
              styles.authorName,
              isAnon && styles.authorNameAnon,
            )}
          >
            {authorName}
          </span>
          <span aria-hidden {...stylex.props(styles.dot)}>
            ·
          </span>
          <span {...stylex.props(styles.when)}>
            {formatRelativeTime(discussion.createdAt)}
          </span>
        </Flex>
        <div {...stylex.props(styles.footRight)}>
          <Link
            href={discussionLink(discussion.uri)}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.openLink}
          >
            <ExternalLink size={13} strokeWidth={2} /> Open
          </Link>
          <button
            type="button"
            {...stylex.props(
              styles.upvote,
              upvoted && styles.upvoteActive,
              !signedIn && styles.upvoteDisabled,
            )}
            title={title}
            aria-label={title}
            aria-pressed={upvoted}
            disabled={!signedIn}
            onClick={() => onUpvote(discussion)}
          >
            <ArrowBigUp
              size={14}
              strokeWidth={2}
              {...stylex.props(
                styles.upvoteIcon,
                upvoted && styles.upvoteIconActive,
              )}
              aria-hidden
            />
            {count}
          </button>
        </div>
      </div>
    </article>
  );
}

function DiscussionCardSkeleton() {
  return (
    <div {...stylex.props(styles.skelCard)} aria-hidden>
      <div {...stylex.props(styles.skelHead)}>
        <Skeleton variant="rectangle" height={spacing["4"]} width="62%" />
        <Skeleton
          variant="rectangle"
          height={spacing["6"]}
          width={spacing["20"]}
        />
      </div>
      <Flex direction="column" gap="md">
        <Skeleton variant="rectangle" height={spacing["3"]} width="100%" />
        <Skeleton variant="rectangle" height={spacing["3"]} width="84%" />
      </Flex>
      <div {...stylex.props(styles.skelFoot)}>
        <Flex align="center" gap="sm">
          <Skeleton variant="circle" size="sm" />
          <Skeleton
            variant="rectangle"
            height={spacing["3"]}
            width={spacing["32"]}
          />
        </Flex>
        <Skeleton
          variant="rectangle"
          height={spacing["6"]}
          width={spacing["14"]}
        />
      </div>
    </div>
  );
}

function DiscussionListSkeleton() {
  return (
    <div
      {...stylex.props(styles.list)}
      aria-busy="true"
      aria-label="Loading feedback"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <DiscussionCardSkeleton key={i} />
      ))}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p {...stylex.props(styles.message)}>{children}</p>;
}

type SortMode = "top" | "new";

type TagFilter = FeedbackTag | "all";

const TAG_FILTER_OPTIONS: Array<{ id: TagFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "bug", label: "Bugs" },
  { id: "feature", label: "Feature requests" },
  { id: "question", label: "Questions" },
];

/**
 * Everything the masthead doesn't need — the discussions query, filters, and
 * upvote logic. Split out so `FeedbackPage`'s header + submit button render
 * unconditionally instead of waiting on this data (see the route's
 * non-blocking loader).
 */
function FeedbackDiscussions({ signedIn }: { signedIn: boolean }) {
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    userinputApi.getFeedbackDiscussionsQueryOptions({ limit: 50 }),
  );
  // Locally-tracked upvotes. Seeded from the server's `viewerUpvotedUris`
  // (the viewer's own `app.userinput.upvote` records, loaded in the same
  // round trip as the discussions) and extended with optimistic upvotes cast
  // in the current session. After a mutation settles we invalidate the
  // discussions query, which re-fetches `viewerUpvotedUris` and reconciles
  // the set with the network state below.
  const [upvotedUris, setUpvotedUris] = useState<Set<string>>(
    () => new Set(data.viewerUpvotedUris),
  );
  // Reconcile with the server whenever the query refetches (e.g. after
  // `invalidateQueries` in the mutation's `onSettled`). The fresh server
  // response includes any upvote just written, so this replaces local state
  // rather than merging — no risk of dropping an in-flight optimistic mark
  // since `onSettled` fires after the write succeeded.
  useEffect(() => {
    setUpvotedUris(new Set(data.viewerUpvotedUris));
  }, [data.viewerUpvotedUris]);
  // The server's view of the viewer's upvotes — used to detect optimistic-only
  // upvotes (locally upvoted but not yet in the server count) so the displayed
  // count doesn't double-count the viewer's already-included upvote.
  const serverUpvotedUris = useMemo(
    () => new Set(data.viewerUpvotedUris),
    [data.viewerUpvotedUris],
  );

  const discussionsQueryKey = userinputApi.getFeedbackDiscussionsQueryOptions({
    limit: 50,
  }).queryKey;

  const upvoteMutation = useMutation({
    mutationFn: async ({
      discussion,
      upvoted,
    }: {
      discussion: UserinputDiscussion;
      upvoted: boolean;
    }): Promise<{ authorizationUrl?: string }> => {
      // Removing an existing upvote — no scope upgrade needed (the viewer
      // already granted the scope to create it). Just delete the record.
      if (upvoted) {
        await userinputApi.deleteUserinputUpvote({
          data: {
            subjectUri: discussion.uri,
            ...(discussion.cid ? { subjectCid: discussion.cid } : {}),
          },
        });
        return {};
      }
      try {
        await userinputApi.createUserinputUpvote({
          data: {
            subjectUri: discussion.uri,
            ...(discussion.cid ? { subjectCid: discussion.cid } : {}),
          },
        });
        return {};
      } catch (error) {
        if (!isAtprotoScopeMissingError(error, "app.userinput.upvote")) {
          throw error;
        }
        // Scope missing — stash an upvote draft, then kick off the upgrade
        // flow. The landing page consumes the draft and creates the upvote
        // record after OAuth completes.
        const draft = await userinputApi.createUpvoteDraft({
          data: { subjectUri: discussion.uri },
        });
        const result = await auth.upgradeToUserinputFeedback({
          data: { redirect: `/feedback/return?upvote=${draft.id}` },
        });
        return { authorizationUrl: result.authorizationUrl };
      }
    },
    onMutate: ({ discussion, upvoted }) => {
      // Optimistic: flip the local mark immediately so the button reflects the
      // click. The cache is left untouched — `discussion.upvoteCount` is the
      // network value and the card adjusts the count for optimistic state.
      setUpvotedUris((prev) => {
        const next = new Set(prev);
        if (upvoted) {
          next.delete(discussion.uri);
        } else {
          next.add(discussion.uri);
        }
        return next;
      });
    },
    onSuccess: (result) => {
      if (result.authorizationUrl) {
        globalThis.location.href = result.authorizationUrl;
      }
    },
    onError: (_error, { discussion, upvoted }) => {
      // Roll back the optimistic flip.
      setUpvotedUris((prev) => {
        const next = new Set(prev);
        if (upvoted) {
          next.add(discussion.uri);
        } else {
          next.delete(discussion.uri);
        }
        return next;
      });
    },
    onSettled: () => {
      // Refetch so the network upvote count + viewer upvoted set reconcile.
      void queryClient.invalidateQueries({ queryKey: discussionsQueryKey });
    },
  });

  const handleToggleUpvote = (discussion: UserinputDiscussion) => {
    if (!signedIn) return;
    if (upvoteMutation.isPending) return;
    const upvoted = upvotedUris.has(discussion.uri);
    upvoteMutation.mutate({ discussion, upvoted });
  };

  const allDiscussions = data?.discussions ?? [];

  // Client-side filter + search + sort. All cheap (tens of items), so no
  // need to round-trip to the server when the user toggles a control.
  const q = search.trim().toLowerCase();
  let discussions = allDiscussions;
  if (tagFilter !== "all") {
    discussions = discussions.filter((d) => tagFor(d) === tagFilter);
  }
  if (q) {
    discussions = discussions.filter((d) => {
      return (
        d.title.toLowerCase().includes(q) ||
        (d.body?.toLowerCase().includes(q) ?? false) ||
        (d.author.displayName?.toLowerCase().includes(q) ?? false) ||
        (d.author.handle?.toLowerCase().includes(q) ?? false)
      );
    });
  }
  discussions = discussions.toSorted((a, b) => {
    if (sortMode === "top" && b.upvoteCount !== a.upvoteCount) {
      return b.upvoteCount - a.upvoteCount;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Group by tag only when no tag filter is active and no search is present
  // (the "browse all" view). With an active tag filter or search, show a
  // flat list — grouping a single filtered category is redundant.
  const grouped: Record<FeedbackTag, Array<UserinputDiscussion>> = {
    bug: [],
    feature: [],
    question: [],
  };
  const showGroups = tagFilter === "all" && !search;
  if (showGroups) {
    for (const d of discussions) {
      const tag = tagFor(d);
      if (tag in grouped) {
        grouped[tag].push(d);
      } else {
        grouped.feature.push(d);
      }
    }
  }

  let body: React.ReactNode;
  if (allDiscussions.length === 0) {
    body = (
      <Message>
        <Flex direction="column" gap="md">
          <span>No feedback yet.</span>
          <span {...stylex.props(styles.messageEm)}>
            Be the first to share a bug, idea, or question.
          </span>
        </Flex>
      </Message>
    );
  } else if (discussions.length === 0) {
    body = <Message>No feedback matches your filters.</Message>;
  } else if (showGroups) {
    body = (
      <div {...stylex.props(styles.list)}>
        {STANDARD_READER_FEEDBACK_TAGS.map((t, i) => {
          const items = grouped[t.value];
          if (items.length === 0) return null;
          const isLast = i === STANDARD_READER_FEEDBACK_TAGS.length - 1;
          return (
            <section
              key={t.value}
              {...stylex.props(styles.section, isLast && styles.sectionLast)}
            >
              <div {...stylex.props(styles.groupHead)}>
                <h2 {...stylex.props(styles.groupHeadTitle)}>
                  {TAG_SECTION[t.value]}
                </h2>
                <span {...stylex.props(styles.groupHeadCount)}>
                  {items.length}
                </span>
              </div>
              <div {...stylex.props(styles.list)}>
                {items.map((d) => (
                  <DiscussionCard
                    key={d.uri}
                    discussion={d}
                    signedIn={signedIn}
                    upvotedUris={upvotedUris}
                    serverUpvotedUris={serverUpvotedUris}
                    onUpvote={handleToggleUpvote}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  } else {
    body = (
      <div {...stylex.props(styles.list)}>
        {discussions.map((d) => (
          <DiscussionCard
            key={d.uri}
            discussion={d}
            signedIn={signedIn}
            upvotedUris={upvotedUris}
            serverUpvotedUris={serverUpvotedUris}
            onUpvote={handleToggleUpvote}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {allDiscussions.length === 0 ? null : (
        <div {...stylex.props(styles.toolbar)}>
          <SearchField
            aria-label="Search feedback"
            placeholder="Search feedback..."
            size="lg"
            variant="secondary"
            style={styles.toolbarSearch}
            value={search}
            onChange={setSearch}
          />
          <Select
            aria-label="Filter by tag"
            size="lg"
            variant="secondary"
            selectedKey={tagFilter}
            style={styles.toolbarSelect}
            onSelectionChange={(key) => {
              if (key == null) return;
              setTagFilter(String(key) as TagFilter);
            }}
          >
            {TAG_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
          <SegmentedControl
            aria-label="Sort by"
            size="lg"
            style={styles.toolbarSort}
            selectedKeys={new Set([sortMode])}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (typeof next === "string") {
                setSortMode(next as SortMode);
              }
            }}
          >
            <SegmentedControlItem key="top" id="top">
              <ArrowUp size={13} strokeWidth={2} /> Top
            </SegmentedControlItem>
            <SegmentedControlItem key="new" id="new">
              New
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      )}

      {body}
    </>
  );
}

function FeedbackPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);

  return (
    <ReaderContent>
      <div {...stylex.props(styles.page)}>
        <header {...stylex.props(styles.masthead)}>
          <div>
            <h1 {...stylex.props(styles.title)}>Feedback</h1>
            <p {...stylex.props(styles.dek)}>
              Bug reports, feature requests, and questions for Standard Reader.
              Feedback lives on{" "}
              <Link
                href="https://userinput.app/#/s/did:plc:f4os2wz5fjl56xpwcvtnqu7m/3mprrc56lgd2e"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.dekLink}
              >
                userinput.app
              </Link>
              .
            </p>
          </div>
          {signedIn ? (
            <div {...stylex.props(styles.submitWrap)}>
              <Button
                variant="primary"
                size="lg"
                onPress={() => setDialogOpen(true)}
                style={styles.submitButton}
              >
                <MessageSquarePlus size={16} strokeWidth={2} /> Submit feedback
              </Button>
            </div>
          ) : null}
        </header>

        <Suspense fallback={<DiscussionListSkeleton />}>
          <FeedbackDiscussions signedIn={signedIn} />
        </Suspense>
      </div>

      {signedIn ? (
        <FeedbackDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} />
      ) : null}
    </ReaderContent>
  );
}
