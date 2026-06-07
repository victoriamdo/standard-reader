"use client";

import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";

import {
  applyQuoteHighlightWhenReady,
  scrollQuoteShareMarkIntoView,
} from "#/lib/quote-highlight";
import { resolveQuoteHighlightRange } from "#/lib/quote-highlight-text";
import { useLayoutEffect, useMemo, useRef } from "react";

import { QuoteHighlightProvider } from "./quote-highlight-context";
import { TextSelectionToolbar } from "./text-selection-toolbar";

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
    if (!root || !sharedQuote) return;

    const existingMark = root.querySelector("mark[data-quote-share]");
    if (existingMark instanceof HTMLElement) {
      scrollQuoteShareMarkIntoView(existingMark, root);
      return;
    }

    return applyQuoteHighlightWhenReady(root, sharedQuote);
  }, [sharedQuote]);

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
