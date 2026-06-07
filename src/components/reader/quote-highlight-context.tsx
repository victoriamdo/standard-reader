import type { QuoteHighlightRange } from "#/lib/quote-highlight-text";

import * as stylex from "@stylexjs/stylex";
import { createContext, useContext } from "react";

import { articleBodyStyles } from "./content/body-styles";

const QuoteHighlightTrackerContext =
  createContext<QuoteHighlightTracker | null>(null);

export function QuoteShareMark({ children }: { children: React.ReactNode }) {
  return (
    <mark
      data-quote-share="true"
      {...stylex.props(articleBodyStyles.quoteShareMark)}
    >
      {children}
    </mark>
  );
}

export function intersectHighlightRange(
  global: QuoteHighlightRange | null,
  blockStart: number,
  blockLength: number,
): QuoteHighlightRange | null {
  if (!global || blockLength <= 0) return null;

  const blockEnd = blockStart + blockLength;
  if (global.end <= blockStart || global.start >= blockEnd) return null;

  return {
    start: Math.max(0, global.start - blockStart),
    end: Math.min(blockLength, global.end - blockStart),
  };
}

/** Tracks global quote offsets block-by-block during render. */
export class QuoteHighlightTracker {
  private offset = 0;

  constructor(private readonly global: QuoteHighlightRange | null) {}

  consume(length: number): QuoteHighlightRange | null {
    const local = intersectHighlightRange(this.global, this.offset, length);
    this.offset += length;
    return local;
  }
}

export function useQuoteHighlightTracker(): QuoteHighlightTracker | null {
  return useContext(QuoteHighlightTrackerContext);
}

export function QuoteHighlightProvider({
  range,
  children,
}: {
  range: QuoteHighlightRange | null;
  children: React.ReactNode;
}) {
  const tracker = range ? new QuoteHighlightTracker(range) : null;

  return (
    <QuoteHighlightTrackerContext.Provider value={tracker}>
      {children}
    </QuoteHighlightTrackerContext.Provider>
  );
}

export function HighlightedPlaintext({
  plaintext,
  highlightRange,
}: {
  plaintext: string;
  highlightRange: QuoteHighlightRange | null;
}) {
  if (!highlightRange || highlightRange.start >= highlightRange.end) {
    return plaintext;
  }

  const { start, end } = highlightRange;
  const before = plaintext.slice(0, start);
  const marked = plaintext.slice(start, end);
  const after = plaintext.slice(end);

  return (
    <>
      {before}
      {marked ? <QuoteShareMark>{marked}</QuoteShareMark> : null}
      {after}
    </>
  );
}

export function renderDropCapChar(
  char: string,
  highlightRange: QuoteHighlightRange | null,
): React.ReactNode {
  if (!highlightRange || highlightRange.start >= highlightRange.end) {
    return char;
  }

  const marked = char.slice(
    highlightRange.start,
    Math.min(char.length, highlightRange.end),
  );
  if (!marked) return char;

  const before = char.slice(0, highlightRange.start);
  const after = char.slice(Math.min(char.length, highlightRange.end));
  return (
    <>
      {before}
      <QuoteShareMark>{marked}</QuoteShareMark>
      {after}
    </>
  );
}
