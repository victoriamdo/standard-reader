"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import { readerApi } from "#/integrations/tanstack-query/api-reader.functions";
import { Check, Plus } from "lucide-react";
import { Fragment, useState } from "react";

import type {
  ArticleCard,
  PublicationCard,
} from "../../integrations/tanstack-query/api-shapes";

import {
  AspectRatio,
  AspectRatioImage,
} from "../../design-system/aspect-ratio";
import { Button } from "../../design-system/button";
import { Flex } from "../../design-system/flex";
import { primaryColor, uiColor } from "../../design-system/theme/color.stylex";
import { radius } from "../../design-system/theme/radius.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../../design-system/theme/typography.stylex";
import { Text } from "../../design-system/typography/text";
import { formatDate, formatReaders } from "./format";
import {
  Handle,
  MetaLine,
  PlaceholderImg,
  PublicationAvatar,
  Topic,
} from "./primitives";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  cardLink: {
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    display: "block",
  },
  byline: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  bylineName: {
    color: uiColor.text2,
  },
  feature: {
    alignItems: "center",
    columnGap: '2.25rem',
    display: "grid",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 48rem)": "1.05fr 1fr" },
    rowGap: '2.25rem',
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBottom: "2.25rem",
  },
  featureMedia: {
    borderRadius: radius.md,
    overflow: "hidden",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
  featureTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: { default: "1.75rem", "@media (min-width: 48rem)": "2.4rem" },
    fontWeight: fontWeight.medium,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
  },
  featureDek: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.sm,
  },
  row: {
    alignItems: "start",
    columnGap: '1.5rem',
    display: "grid",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 40rem)": "1fr 150px" },
    rowGap: '1.5rem',
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBottom: "1.5rem",
    paddingTop: "1.5rem",
  },
  rowTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
  },
  rowDek: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    lineHeight: lineHeight.sm,
  },
  rowMedia: {
    borderRadius: radius.md,
    alignSelf: "start",
    display: { default: "none", "@media (min-width: 40rem)": "block" },
    width: "150px",
  },
  mediaFill: {
    inset: 0,
    position: "absolute",
  },
  unreadDot: {
    borderRadius: radius.full,
    backgroundColor: primaryColor.solid1,
    display: "inline-block",
    flexShrink: 0,
    height: "7px",
    marginTop: "0.45rem",
    width: "7px",
  },
  compactRow: {
    alignItems: "baseline",
    columnGap: '0.85rem',
    display: "flex",
    rowGap: '0.85rem',
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: { default: 1, ":last-child": 0 },
    paddingBottom: "0.8rem",
    paddingTop: "0.8rem",
  },
  rank: {
    color: uiColor.text1,
    flexShrink: 0,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    width: "1.4rem",
  },
  compactTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.sm,
  },
  miniRow: {
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBottom: "0.75rem",
    paddingTop: "0.75rem",
  },
  miniName: {
    overflow: "hidden",
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.sm,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  grow: {
 flexBasis: '0%',
 flexGrow: '1',
 flexShrink: '1', minWidth: 0 },
  metaDot: {
    color: uiColor.text1,
  },
});

/* ── Follow toggle ──────────────────────────────────────────────────────── */

export function FollowButton({
  publicationUri,
  signedIn,
  size = "sm",
}: {
  publicationUri: string;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(false);
  const followMutation = useMutation(
    readerApi.followPublicationMutationOptions(),
  );
  const unfollowMutation = useMutation(
    readerApi.unfollowPublicationMutationOptions(),
  );

  if (!signedIn) {
    return (
      <ButtonLink to="/login" variant="secondary" size={size}>
        <Plus size={15} /> Follow
      </ButtonLink>
    );
  }

  const onPress = () => {
    const next = !following;
    setFollowing(next);
    const mutation = next ? followMutation : unfollowMutation;
    mutation.mutate(publicationUri, {
      onError: () => setFollowing(!next),
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
      },
    });
  };

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size={size}
      onPress={onPress}
    >
      {following ? <Check size={15} /> : <Plus size={15} />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}

/* ── Byline ─────────────────────────────────────────────────────────────── */

function Byline({ article }: { article: ArticleCard }) {
  return (
    <Flex align="center" gap="md" style={styles.byline}>
      <PublicationAvatar
        pub={{
          name: article.publicationName ?? "Unknown",
          iconUrl: article.publicationIconUrl,
          ownerAvatarUrl: article.publicationOwnerAvatarUrl,
        }}
        size="sm"
      />
      <span {...stylex.props(styles.bylineName)}>
        {article.publicationName ?? "Unknown publication"}
      </span>
    </Flex>
  );
}

function articleHref(article: ArticleCard): string | undefined {
  return article.canonicalUrl ?? undefined;
}

/** Cover for an article: its own cover image, else the publication banner. */
function coverImage(article: ArticleCard): string | null {
  return article.coverImageUrl ?? article.publicationBannerUrl;
}

/** Topic labels for an article: its own tags, else the publication topic. */
function articleTopics(article: ArticleCard): Array<string> {
  if (article.tags && article.tags.length > 0) {
    return article.tags.slice(0, 2);
  }
  return article.publicationTopic ? [article.publicationTopic] : [];
}

/** Renders `· TOPIC` chips after the date inside a {@link MetaLine}. */
function TopicMeta({ article }: { article: ArticleCard }) {
  return (
    <>
      {articleTopics(article).map((topic) => (
        <Fragment key={topic}>
          <span aria-hidden {...stylex.props(styles.metaDot)}>
            ·
          </span>
          <Topic name={topic} />
        </Fragment>
      ))}
    </>
  );
}

/* ── Feature (hero) ─────────────────────────────────────────────────────── */

export function FeatureArticle({ article }: { article: ArticleCard }) {
  const href = articleHref(article);
  const cover = coverImage(article);
  return (
    <a
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      {...stylex.props(styles.cardLink, styles.feature)}
    >
      <span {...stylex.props(styles.featureMedia)}>
        {cover ? (
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            {...stylex.props(styles.featureMedia)}
          />
        ) : (
          <PlaceholderImg style={styles.featureMedia} />
        )}
      </span>
      <Flex direction="column" gap="xl">
        <Byline article={article} />
        <span {...stylex.props(styles.featureTitle)}>{article.title}</span>
        {article.description ? (
          <span {...stylex.props(styles.featureDek)}>
            {article.description}
          </span>
        ) : null}
        <MetaLine>
          <span>{formatDate(article.publishedAt)}</span>
          <TopicMeta article={article} />
        </MetaLine>
      </Flex>
    </a>
  );
}

/* ── Article row (list) ─────────────────────────────────────────────────── */

export function ArticleRow({
  article,
  unread = false,
}: {
  article: ArticleCard;
  unread?: boolean;
}) {
  const href = articleHref(article);
  const cover = coverImage(article);
  return (
    <a
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      {...stylex.props(styles.cardLink, styles.row)}
    >
      <Flex direction="column" gap="md">
        <Byline article={article} />
        <Flex gap="md" align="start">
          {unread ? <span {...stylex.props(styles.unreadDot)} /> : null}
          <span {...stylex.props(styles.rowTitle)}>{article.title}</span>
        </Flex>
        {article.description ? (
          <span {...stylex.props(styles.rowDek)}>{article.description}</span>
        ) : null}
        <MetaLine>
          <span>{formatDate(article.publishedAt)}</span>
          <TopicMeta article={article} />
        </MetaLine>
      </Flex>
      <AspectRatio aspectRatio={4 / 3} rounded={false} style={styles.rowMedia}>
        {cover ? (
          <AspectRatioImage src={cover} alt="" referrerPolicy="no-referrer" />
        ) : (
          <PlaceholderImg style={styles.mediaFill} />
        )}
      </AspectRatio>
    </a>
  );
}

/* ── Compact row (trending — no image) ──────────────────────────────────── */

export function CompactRow({
  article,
  rank,
}: {
  article: ArticleCard;
  rank: number;
}) {
  const href = articleHref(article);
  return (
    <a
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noreferrer" : undefined}
      {...stylex.props(styles.cardLink, styles.compactRow)}
    >
      <span {...stylex.props(styles.rank)}>
        {String(rank).padStart(2, "0")}
      </span>
      <Flex direction="column" gap="sm" style={styles.grow}>
        <span {...stylex.props(styles.compactTitle)}>{article.title}</span>
        <Text size="xs" variant="secondary">
          {article.publicationName ?? "Unknown"}
        </Text>
      </Flex>
    </a>
  );
}

/* ── Mini publication row (rails) ───────────────────────────────────────── */

export function MiniPubRow({
  pub,
  signedIn,
}: {
  pub: PublicationCard;
  signedIn: boolean;
}) {
  return (
    <Flex align="center" gap="lg" style={styles.miniRow}>
      <PublicationAvatar pub={pub} size="lg" />
      <Flex direction="column" gap="xs" style={styles.grow}>
        <span {...stylex.props(styles.miniName)}>{pub.name}</span>
        <Handle>{`${formatReaders(pub.subscriberCount)} readers`}</Handle>
      </Flex>
      <FollowButton publicationUri={pub.uri} signedIn={signedIn} />
    </Flex>
  );
}

/* ── Compact publication row with topic + readers (directory style) ─────── */

export function PubMetaRow({ pub }: { pub: PublicationCard }) {
  return (
    <MetaLine>
      <Topic name={pub.topic} />
      <span>{`${formatReaders(pub.subscriberCount)} readers`}</span>
    </MetaLine>
  );
}
