"use client";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { initials } from "#/components/reader/format";
import { formatRelativeTime } from "#/components/reader/format";
import { PublicationAvatar } from "#/components/reader/primitives";
import { Avatar } from "#/design-system/avatar";
import { uiColor } from "#/design-system/theme/color.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import { gap } from "#/design-system/theme/semantic-spacing.stylex";
import { spacing } from "#/design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "#/design-system/theme/typography.stylex";
import { authorApi } from "#/integrations/tanstack-query/api-author.functions";
import { publicationApi } from "#/integrations/tanstack-query/api-publication.functions";
import { fetchMiniPost, pcktNoteUrl } from "#/lib/pckt/mini";

// An embedded pckt note, delineated from the article prose by a bordered card
// (mirroring the sibling Bluesky post embed). The body is set in the serif
// reading face so the note stays in the article's voice; identity + date frame
// it as metadata. The whole card links to the note on pckt.
const styles = stylex.create({
  card: {
    display: "flex",
    flexDirection: "column",
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    paddingTop: spacing["4"],
    paddingInline: spacing["4"],
    paddingBottom: spacing["3"],
    marginBlock: spacing["6"],
    textDecoration: "none",
    color: "inherit",
    transitionProperty: "border-color",
    transitionDuration: "150ms",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: gap.lg,
    minWidth: 0,
  },
  avatarRound: {
    borderRadius: radius.full,
  },
  meta: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flexGrow: 1,
    rowGap: spacing["2"],
    lineHeight: lineHeight.xs,
  },
  name: {
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.base,
    color: uiColor.text2,
  },
  handle: {
    color: uiColor.text1,
    fontSize: fontSize.base,
  },
  body: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.sm,
    marginTop: spacing["4"],
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  time: {
    color: uiColor.text1,
    fontSize: fontSize.sm,
    marginTop: spacing["2"],
  },
});

/** Renders `blog.pckt.block.noteEmbed` — a pckt note embedded inline in a post. */
export function PcktNoteEmbedView({
  noteRef,
}: {
  noteRef?: { uri?: string; cid?: string };
}) {
  const uri = noteRef?.uri?.trim();

  const { data: note } = useQuery({
    queryKey: ["pckt-mini-post", uri] as const,
    queryFn: async () => (uri ? fetchMiniPost(uri) : null),
    enabled: Boolean(uri),
    staleTime: 5 * 60 * 1000,
  });

  const { data: summary } = useQuery({
    ...authorApi.getAuthorSummaryQueryOptions(note?.did ?? ""),
    enabled: Boolean(note?.did),
  });
  const author = summary?.profile;

  // Notes published under a blog (`publication` set) show the publication —
  // its icon, name, and domain — instead of the author.
  const { data: pubHeader } = useQuery({
    ...publicationApi.getPublicationHeaderQueryOptions(
      note?.publicationUri ?? "",
    ),
    enabled: Boolean(note?.publicationUri),
  });

  if (!uri || !note) return null;

  const asPublication = pubHeader ?? null;
  const resolvedHref = pcktNoteUrl(note.did, note.rkey);

  const name = asPublication
    ? asPublication.publication.name
    : author?.displayName?.trim() ||
      (author?.handle ? `@${author.handle}` : note.did.slice(0, 16));
  const handle = asPublication
    ? asPublication.owner.handle
      ? `@${asPublication.owner.handle}`
      : null
    : author?.handle
      ? `@${author.handle}`
      : null;

  const avatar = asPublication ? (
    <PublicationAvatar pub={asPublication.publication} size="lg" />
  ) : (
    <Avatar
      size="lg"
      src={author?.avatarUrl ?? undefined}
      fallback={initials(name)}
      alt={name}
      style={styles.avatarRound}
    />
  );

  const inner = (
    <>
      <div {...stylex.props(styles.header)}>
        {avatar}
        <div {...stylex.props(styles.meta)}>
          <span {...stylex.props(styles.name)}>{name}</span>
          {handle ? <span {...stylex.props(styles.handle)}>{handle}</span> : null}
        </div>
      </div>
      <div {...stylex.props(styles.body)}>{note.text}</div>
      <time dateTime={note.createdAt} {...stylex.props(styles.time)}>
        {formatRelativeTime(note.createdAt)}
      </time>
    </>
  );

  return resolvedHref ? (
    <a
      href={resolvedHref}
      target="_blank"
      rel="noreferrer"
      {...stylex.props(styles.card)}
    >
      {inner}
    </a>
  ) : (
    <div {...stylex.props(styles.card)}>{inner}</div>
  );
}
