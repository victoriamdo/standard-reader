"use client";

import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { useHover } from "react-aria";

import { AppLink } from "#/components/reader/app-link";
import { initials } from "#/components/reader/format";
import { PublicationAvatar } from "#/components/reader/primitives";
import {
  DropCapChar,
  QuoteShareMark,
} from "#/components/reader/quote-highlight-context";
import {
  intersectHighlightRange,
  useQuoteHighlightTracker,
} from "#/components/reader/quote-highlight-tracker";
import { Avatar } from "#/design-system/avatar";
import { segmentFacetedText, shiftFacets } from "#/lib/leaflet/facets";
import type {
  ResolvedActorMention,
  ResolvedDocumentMention,
  ResolvedPublicationMention,
} from "#/lib/leaflet/publication-mentions";
import {
  lookupActorMention,
  lookupDocumentMention,
  lookupPublicationMention,
} from "#/lib/leaflet/publication-mentions";
import type { LeafletFacet } from "#/lib/leaflet/types";
import { utf8ByteLength } from "#/lib/leaflet/utf8";
import type { QuoteHighlightRange } from "#/lib/quote-highlight-text";
import { useReadingTypography } from "#/lib/use-reading-typography";

import { articleBodyStyles, readingDropCapStyleProps } from "../../body-styles";
import type { FacetFeature } from "./facets";
import { findFacetFeature, hasFacetKind } from "./facets";
import { useInlineMentions } from "./publication-mention-context";

const styles = stylex.create({
  mentionChip: {
    whiteSpace: "nowrap",
  },
  // Shrink the design-system Avatar to sit inline with body text.
  mentionAvatar: {
    display: "inline-flex",
    width: "1.05em",
    height: "1.05em",
    marginRight: "0.25em",
    verticalAlign: "-0.2em",
  },
});

/**
 * Inline publication reference — the pub's icon (when it has one) + name,
 * linking to its Standard Reader page. Mirrors how Leaflet renders publication
 * tags. Publications without an icon render name-only rather than falling back
 * to initials.
 */
function PublicationMentionChip({
  mention,
  children,
}: {
  mention: ResolvedPublicationMention;
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/p/$did/$rkey"
      params={{ did: mention.did, rkey: mention.rkey }}
      {...stylex.props(
        articleBodyStyles.publicationBylineLink,
        styles.mentionChip,
      )}
    >
      {mention.iconUrl ? (
        <PublicationAvatar
          pub={{ name: mention.name, iconUrl: mention.iconUrl }}
          size="sm"
          style={styles.mentionAvatar}
        />
      ) : null}
      {children}
    </Link>
  );
}

/**
 * Inline document reference — an `#atMention` whose target is a
 * `pub.leaflet.document`. Links to the document's Standard Reader page
 * (`/a/$did/$rkey`), keeping the facet's plaintext (usually the title) as the
 * label. Until it resolves the segment falls back to plain text.
 */
function DocumentMentionChip({
  mention,
  children,
}: {
  mention: ResolvedDocumentMention;
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/a/$did/$rkey"
      params={{ did: mention.did, rkey: mention.rkey }}
      {...stylex.props(articleBodyStyles.facetLink, styles.mentionChip)}
    >
      {children}
    </Link>
  );
}

/**
 * Inline actor (`#didMention`) reference. Once resolved, shows the actor's
 * avatar in place of the leading `@` and links to their profile; until then it
 * falls back to the original `@handle` text.
 */
function ActorMentionChip({
  did,
  actor,
  text,
}: {
  did: string;
  actor: ResolvedActorMention | null;
  text: string;
}) {
  // Only swap the leading `@` for an avatar once the actor resolves; until then
  // keep the original `@handle` so there is no flash of bare text.
  const label = actor ? text.replace(/^@/, "") : text;
  const { isHovered, hoverProps } = useHover({});
  return (
    <Link
      to="/u/$did"
      params={{ did }}
      {...stylex.props(articleBodyStyles.facetMentionLink, styles.mentionChip)}
      data-hovered={isHovered || undefined}
      {...hoverProps}
    >
      {actor ? (
        <Avatar
          size="sm"
          src={actor.avatarUrl ?? undefined}
          fallback={initials(actor.handle ?? label)}
          alt={actor.handle ?? ""}
          style={styles.mentionAvatar}
        />
      ) : null}
      {label}
    </Link>
  );
}

function FacetSegment({
  text,
  features,
}: {
  text: string;
  features: Array<FacetFeature>;
}) {
  const { publications, documents, actors } = useInlineMentions();

  if (features.length === 0) return <>{text}</>;

  const isBold =
    hasFacetKind(features, "bold") || hasFacetKind(features, "strong");
  const isItalic = hasFacetKind(features, "italic");
  const isCode = hasFacetKind(features, "code");
  const isUnderline = hasFacetKind(features, "underline");
  const isStrikethrough = hasFacetKind(features, "strikethrough");
  const isHighlight = hasFacetKind(features, "highlight");
  const link = findFacetFeature(features, "link");
  const didMention =
    findFacetFeature(features, "didMention") ??
    findFacetFeature(features, "mention");
  const publicationMention = lookupPublicationMention(features, publications);
  const documentMention = lookupDocumentMention(features, documents);

  let node: React.ReactNode = text;

  if (isCode) {
    node = <code {...stylex.props(articleBodyStyles.facetCode)}>{text}</code>;
  }

  if (publicationMention) {
    node = (
      <PublicationMentionChip mention={publicationMention}>
        {text}
      </PublicationMentionChip>
    );
  } else if (documentMention) {
    node = (
      <DocumentMentionChip mention={documentMention}>
        {text}
      </DocumentMentionChip>
    );
  } else if (link?.uri) {
    node = (
      <AppLink href={link.uri} linkStyle={articleBodyStyles.facetLink}>
        {text}
      </AppLink>
    );
  } else if (didMention?.did) {
    node = (
      <ActorMentionChip
        did={didMention.did}
        actor={lookupActorMention(features, actors)}
        text={text}
      />
    );
  }

  if (isHighlight) {
    node = (
      <mark {...stylex.props(articleBodyStyles.facetHighlight)}>{node}</mark>
    );
  }

  if (isStrikethrough) {
    node = (
      <s {...stylex.props(articleBodyStyles.facetStrikethrough)}>{node}</s>
    );
  }

  if (isUnderline) {
    node = <u {...stylex.props(articleBodyStyles.facetUnderline)}>{node}</u>;
  }

  if (isItalic) {
    node = <em {...stylex.props(articleBodyStyles.facetItalic)}>{node}</em>;
  }

  if (isBold) {
    node = (
      <strong {...stylex.props(articleBodyStyles.facetBold)}>{node}</strong>
    );
  }

  return <>{node}</>;
}

export function FacetedPlaintext({
  plaintext,
  facets,
}: {
  plaintext: string;
  facets?: Array<LeafletFacet> | Array<unknown>;
}) {
  const segments = segmentFacetedText(plaintext, facets);
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          <FacetSegment text={segment.text} features={segment.features} />
        </Fragment>
      ))}
    </>
  );
}

function facetsForSlice(
  facets: Array<LeafletFacet> | Array<unknown> | undefined,
  plaintext: string,
  sliceStart: number,
): Array<LeafletFacet> | Array<unknown> | undefined {
  if (!facets?.length || sliceStart <= 0) return facets;
  const byteOffset = utf8ByteLength(plaintext.slice(0, sliceStart));
  return shiftFacets(facets, byteOffset);
}

export function HighlightedFacetedPlaintext({
  plaintext,
  facets,
  highlightRange,
}: {
  plaintext: string;
  facets?: Array<LeafletFacet> | Array<unknown>;
  highlightRange: QuoteHighlightRange | null;
}) {
  if (!highlightRange || highlightRange.start >= highlightRange.end) {
    return <FacetedPlaintext plaintext={plaintext} facets={facets} />;
  }

  const { start, end } = highlightRange;
  const slices = [
    { sliceStart: 0, sliceEnd: start, mark: false },
    { sliceStart: start, sliceEnd: end, mark: true },
    { sliceStart: end, sliceEnd: plaintext.length, mark: false },
  ].filter((slice) => slice.sliceEnd > slice.sliceStart);

  return (
    <>
      {slices.map((slice) => {
        const text = plaintext.slice(slice.sliceStart, slice.sliceEnd);
        const sliceFacets = facetsForSlice(facets, plaintext, slice.sliceStart);
        const content = (
          <FacetedPlaintext plaintext={text} facets={sliceFacets} />
        );

        return slice.mark ? (
          <QuoteShareMark key={`${slice.sliceStart}-${slice.sliceEnd}`}>
            {content}
          </QuoteShareMark>
        ) : (
          <Fragment key={`${slice.sliceStart}-${slice.sliceEnd}`}>
            {content}
          </Fragment>
        );
      })}
    </>
  );
}

export function TextBlockView({
  plaintext,
  facets,
  dropCap = false,
  embedded = false,
}: {
  plaintext: string;
  facets?: Array<LeafletFacet> | Array<unknown>;
  dropCap?: boolean;
  embedded?: boolean;
}) {
  const tracker = useQuoteHighlightTracker();
  const { preference } = useReadingTypography();
  const highlightRange = tracker?.consume(plaintext.length) ?? null;

  if (!plaintext) return null;

  const paragraphStyle = embedded
    ? articleBodyStyles.pageEmbedBlockSpacing
    : articleBodyStyles.paragraph;

  if (dropCap) {
    const chars = [...plaintext];
    const firstChar = chars[0] ?? "";
    const rest = chars.slice(1).join("");
    const byteOffset = utf8ByteLength(firstChar);
    const firstCharRange = intersectHighlightRange(highlightRange, 0, 1);
    const restRange = intersectHighlightRange(
      highlightRange,
      1,
      Math.max(0, plaintext.length - 1),
    );

    return (
      <p {...stylex.props(paragraphStyle, articleBodyStyles.dropCapParagraph)}>
        <span {...readingDropCapStyleProps(preference)} aria-hidden>
          <DropCapChar char={firstChar} highlightRange={firstCharRange} />
        </span>
        <HighlightedFacetedPlaintext
          plaintext={rest}
          facets={shiftFacets(facets, byteOffset)}
          highlightRange={restRange}
        />
      </p>
    );
  }

  return (
    <p {...stylex.props(paragraphStyle)}>
      <HighlightedFacetedPlaintext
        plaintext={plaintext}
        facets={facets}
        highlightRange={highlightRange}
      />
    </p>
  );
}
