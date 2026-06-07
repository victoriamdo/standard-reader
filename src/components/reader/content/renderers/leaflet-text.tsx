"use client";

import type { LeafletTextBlock } from "#/lib/leaflet/types";

import * as stylex from "@stylexjs/stylex";
import { segmentFacetedText, shiftFacets } from "#/lib/leaflet/facets";
import { LEAFLET_FACET } from "#/lib/leaflet/types";
import { utf8ByteLength } from "#/lib/leaflet/utf8";
import { Fragment } from "react";

import { articleBodyStyles } from "../body-styles";

function FacetSegment({
  text,
  features,
}: {
  text: string;
  features: Array<{ $type?: string; uri?: string }>;
}) {
  if (features.length === 0) return <>{text}</>;

  const isBold = features.some((f) => f.$type === LEAFLET_FACET.bold);
  const isItalic = features.some((f) => f.$type === LEAFLET_FACET.italic);
  const isCode = features.some((f) => f.$type === LEAFLET_FACET.code);
  const link = features.find((f) => f.$type === LEAFLET_FACET.link && f.uri);

  let node: React.ReactNode = text;

  if (isCode) {
    node = <code {...stylex.props(articleBodyStyles.facetCode)}>{text}</code>;
  }

  if (link?.uri) {
    node = (
      <a
        href={link.uri}
        target="_blank"
        rel="noreferrer"
        {...stylex.props(articleBodyStyles.facetLink)}
      >
        {text}
      </a>
    );
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
  facets: LeafletTextBlock["facets"];
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

export function LeafletTextBlockView({
  block,
  dropCap = false,
}: {
  block: LeafletTextBlock;
  dropCap?: boolean;
}) {
  if (!block.plaintext) return null;

  if (dropCap) {
    const chars = [...block.plaintext];
    const firstChar = chars[0] ?? "";
    const rest = chars.slice(1).join("");
    const byteOffset = utf8ByteLength(firstChar);

    return (
      <p
        {...stylex.props(
          articleBodyStyles.paragraph,
          articleBodyStyles.dropCapParagraph,
        )}
      >
        <span {...stylex.props(articleBodyStyles.dropCap)} aria-hidden>
          {firstChar}
        </span>
        <FacetedPlaintext
          plaintext={rest}
          facets={shiftFacets(block.facets, byteOffset)}
        />
      </p>
    );
  }

  return (
    <p {...stylex.props(articleBodyStyles.paragraph)}>
      <FacetedPlaintext plaintext={block.plaintext} facets={block.facets} />
    </p>
  );
}
