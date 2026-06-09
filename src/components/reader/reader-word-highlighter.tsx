"use client";

import type { HighlightMap } from "#/lib/page-reader/word-highlight";

import { usePageReader } from "#/lib/page-reader/page-reader-context";
import {
  buildHighlightMap,
  clearWordHighlight,
  matchedSentenceCount,
  rangeForToken,
  scrollWordIntoView,
  setWordHighlight,
  tokenIndexForProgress,
} from "#/lib/page-reader/word-highlight";
import { useEffect, useRef } from "react";

/** Throttle for (re)building the DOM↔sentence map while it isn't ready yet. */
const BUILD_RETRY_MS = 300;

/**
 * Drives karaoke-style word highlighting for the article that's currently
 * playing. It aligns the engine's narration sentences to this article's DOM and,
 * while playing, moves a CSS highlight to the active word and keeps it in view.
 * Renders nothing.
 */
export function ReaderWordHighlighter({
  rootRef,
  articleUri,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  articleUri: string;
}) {
  const { state, nowPlaying, getSentences, getProgress } = usePageReader();
  const isCurrent = nowPlaying?.uri === articleUri;
  const { status } = state;

  const mapRef = useRef<HighlightMap | null>(null);
  const builtForRef = useRef<ReadonlyArray<string> | null>(null);
  const lastTokenRef = useRef(-1);
  const lastBuildRef = useRef(0);

  // Drop any cached map when the loaded article changes.
  useEffect(() => {
    mapRef.current = null;
    builtForRef.current = null;
    lastTokenRef.current = -1;
    lastBuildRef.current = 0;
  }, [isCurrent, articleUri]);

  // Move the highlight to the active word each frame while playing. The map is
  // built lazily here (once sentences + content are ready, regardless of how
  // long the model took to load). Pausing leaves the word lit; leaving clears it.
  useEffect(() => {
    if (!isCurrent) {
      clearWordHighlight();
      lastTokenRef.current = -1;
      return;
    }
    if (status !== "playing") return;

    // Async content (e.g. a Bluesky embed that fetches and swaps its skeleton for
    // the real post) can appear after the map is built. Rebuild on DOM changes so
    // the new text gets aligned and token offsets stay correct. Debounced so a
    // burst of mutations only triggers one rebuild.
    const observerRoot = rootRef.current;
    const Observer = globalThis.MutationObserver;
    let observer: MutationObserver | null = null;
    let dirtyTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    if (observerRoot && Observer) {
      observer = new Observer(() => {
        if (dirtyTimer !== null) return;
        dirtyTimer = globalThis.setTimeout(() => {
          dirtyTimer = null;
          mapRef.current = null;
          builtForRef.current = null;
          lastTokenRef.current = -1;
          lastBuildRef.current = 0;
        }, 150);
      });
      observer.observe(observerRoot, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);

      // Invalidate the cached map when the narration set changes (e.g. switching
      // from a full-article read to a play-from-selection), since indices are
      // relative to those sentences. `prepare` makes a fresh array each time.
      const sentences = getSentences();
      let map = mapRef.current;
      if (map && sentences !== builtForRef.current) {
        map = null;
        mapRef.current = null;
        builtForRef.current = null;
        lastTokenRef.current = -1;
        clearWordHighlight();
      }

      if (!map) {
        const now = Date.now();
        if (now - lastBuildRef.current < BUILD_RETRY_MS) return;
        lastBuildRef.current = now;
        const root = rootRef.current;
        if (!root || sentences.length === 0) return;
        const built = buildHighlightMap(root, sentences);
        if (matchedSentenceCount(built) === 0) return;
        mapRef.current = built;
        builtForRef.current = sentences;
        map = built;
      }

      const progress = getProgress();
      if (!progress) return;
      const run = map.sentenceTokens[progress.index];
      if (!run) return;

      const tokenIndex = tokenIndexForProgress(run, progress.fraction);
      if (tokenIndex === lastTokenRef.current) return;

      const range = rangeForToken(map, tokenIndex);
      if (!range) {
        // DOM changed under us; rebuild on a later frame.
        mapRef.current = null;
        return;
      }
      lastTokenRef.current = tokenIndex;

      const root = rootRef.current;
      if (setWordHighlight(range) && root) scrollWordIntoView(range, root);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (dirtyTimer !== null) globalThis.clearTimeout(dirtyTimer);
    };
  }, [isCurrent, status, rootRef, getSentences, getProgress]);

  // Clear the highlight when the article view unmounts.
  useEffect(() => () => clearWordHighlight(), []);

  return null;
}
