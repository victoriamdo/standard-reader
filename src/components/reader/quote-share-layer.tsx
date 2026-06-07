"use client";

import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";

import {
  applyQuoteHighlightByOffsets,
  applyQuoteHighlightWhenReady,
  scrollQuoteShareMarkIntoView,
} from "#/lib/quote-highlight";
import { resolveQuoteHighlightRange } from "#/lib/quote-highlight-text";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { QuoteHighlightProvider } from "./quote-highlight-context";
import { TextSelectionToolbar } from "./text-selection-toolbar";

function scrollToQuoteMark(root: HTMLElement): boolean {
  const mark = root.querySelector("mark[data-quote-share]");
  if (!(mark instanceof HTMLElement)) return false;
  scrollQuoteShareMarkIntoView(mark, root, { behavior: "instant" });
  return true;
}

export function QuoteShareLayer({
  article,
  documentUri,
  did,
  rkey,
  articleTitle,
  sharedQuote,
  children,
}: {
  article: ArticleDetail;
  documentUri: string;
  did: string;
  rkey: string;
  articleTitle: string;
  sharedQuote?: string | null;
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const highlightRange = useMemo(
    () =>
      sharedQuote ? resolveQuoteHighlightRange(article, sharedQuote) : null,
    [article, sharedQuote],
  );

  useLayoutEffect(() => {
    const root = bodyRef.current;
    if (!root || !sharedQuote || !highlightRange) return;

    applyQuoteHighlightByOffsets(
      root,
      highlightRange.start,
      highlightRange.end,
    );
  }, [sharedQuote, highlightRange]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root || !sharedQuote || !highlightRange) return;

    let cancelled = false;
    let cleanupReady: (() => void) | undefined;

    const syncScroll = () => {
      if (cancelled) return;
      scrollToQuoteMark(root);
    };

    if (!scrollToQuoteMark(root)) {
      cleanupReady = applyQuoteHighlightWhenReady(
        root,
        sharedQuote,
        syncScroll,
      );
    }

    // Run again on the next frame so router scroll restoration cannot win.
    const frame = requestAnimationFrame(syncScroll);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cleanupReady?.();
    };
  }, [sharedQuote, highlightRange]);

  return (
    <QuoteHighlightProvider range={highlightRange}>
      <div ref={bodyRef} data-article-body="">
        {children}
        <TextSelectionToolbar
          rootRef={bodyRef}
          documentUri={documentUri}
          did={did}
          rkey={rkey}
          articleTitle={articleTitle}
        />
      </div>
    </QuoteHighlightProvider>
  );
}
