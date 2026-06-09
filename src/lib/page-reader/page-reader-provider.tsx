"use client";

import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";

import {
  articleBskyPostUris,
  articleSpeechText,
  speechAuthor,
} from "#/components/reader/content/extract-text";
import { documentLinkParams } from "#/components/reader/format";
import { bskyApi } from "#/integrations/tanstack-query/api-bsky.functions";
import { normalizeQuoteText } from "#/lib/quote-share";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { NowPlaying, PageReaderContextValue } from "./page-reader-context";
import type { ReaderState } from "./page-reader-engine";
import type { ReaderVoice } from "./voice";

import { PageReaderContext } from "./page-reader-context";
import { PageReaderEngine } from "./page-reader-engine";
import { articleVoice } from "./voice";

const INITIAL_STATE: ReaderState = {
  status: "idle",
  currentTime: 0,
  duration: 0,
  modelProgress: 0,
  generationProgress: 0,
  rate: 1,
  error: null,
};

/** Escape a string for safe use as a literal inside a RegExp. */
function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * When a selection is found within the article, return the article text from
 * that passage onward. The passage is located whitespace-insensitively but the
 * returned slice comes from the *original* text so its paragraph breaks (`\n`)
 * survive — those are what drive sentence splitting and word-highlight
 * alignment. Falls back to the raw/normalized selection when no match is found.
 */
function textFromSelection(fullText: string, selectionText: string): string {
  const normalizedSelection = normalizeQuoteText(selectionText);
  if (!normalizedSelection) return selectionText;

  // Match the selection against the original text, letting any whitespace run
  // (including newlines) stand in for the single spaces in the normalized form.
  const pattern = escapeRegExp(normalizedSelection).replaceAll(
    / +/g,
    String.raw`\s+`,
  );
  const match = new RegExp(pattern).exec(fullText);
  if (match) return fullText.slice(match.index);

  const normalizedFull = normalizeQuoteText(fullText);
  const index = normalizedFull.indexOf(normalizedSelection);
  return index === -1 ? normalizedSelection : normalizedFull.slice(index);
}

/**
 * Build the narration text, fetching any embedded Bluesky posts so they're read
 * (author + content) inline at their position in the body. Failures fall back to
 * narrating the article without the embed.
 */
async function buildNarration(article: ArticleDetail): Promise<string | null> {
  const uris = articleBskyPostUris(article);
  let embeds: Map<string, string> | undefined;
  if (uris.length > 0) {
    try {
      const posts = await bskyApi.getEmbedPosts({ data: { uris } });
      const entries = posts
        .filter((post) => post.author && post.text.trim().length > 0)
        .map((post): [string, string] => [
          post.uri,
          // Author name then post body as separate paragraphs. Use the bare name
          // (not "X posted:") so every narrated word also exists in the rendered
          // embed, letting the word-highlighter align and mark it.
          `${post.author}\n\n${post.text.trim()}`,
        ]);
      if (entries.length > 0) embeds = new Map(entries);
    } catch {
      // Narrate without the embed if the lookup fails.
    }
  }
  return articleSpeechText(article, embeds)?.trim() ?? null;
}

/** Capture the metadata the global player bar shows while an article plays. */
function nowPlayingFromArticle(article: ArticleDetail): NowPlaying {
  const params = documentLinkParams(article.uri);
  return {
    uri: article.uri,
    did: params?.did ?? "",
    rkey: params?.rkey ?? "",
    title: article.title?.trim() || "Untitled",
    publicationName: article.publication?.name ?? null,
    author: speechAuthor(article),
  };
}

/**
 * App-level page-reader state. Mounted once in the shell so playback (and the
 * player bar) persist across navigation; `nowPlaying` carries the metadata for
 * whatever is loaded so the bar can show it when the user leaves the article.
 */
export function PageReaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const engineRef = useRef<PageReaderEngine | null>(null);
  const preparedRef = useRef<{ uri: string; text: string } | null>(null);
  const lastPlaybackRef = useRef<{
    article: ArticleDetail;
    text: string;
  } | null>(null);
  const voiceCacheRef = useRef(new Map<string, Promise<ReaderVoice>>());
  const narrationCacheRef = useRef(new Map<string, Promise<string | null>>());
  const [state, setState] = useState<ReaderState>(INITIAL_STATE);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [scrollLocked, setScrollLocked] = useState(true);

  // One engine for the session; survives route changes, torn down on unmount.
  useEffect(() => {
    const engine = new PageReaderEngine();
    engineRef.current = engine;
    const unsubscribe = engine.subscribe(setState);

    return () => {
      unsubscribe();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Lazily detect the narration voice per article (loads the tiny model);
  // memoized by URI so replays reuse the result.
  const getVoicePromise = useCallback((article: ArticleDetail) => {
    const cache = voiceCacheRef.current;
    let promise = cache.get(article.uri);
    if (!promise) {
      promise = articleVoice(article);
      cache.set(article.uri, promise);
    }
    return promise;
  }, []);

  const startPlayback = useCallback(
    (article: ArticleDetail, text: string) => {
      const engine = engineRef.current;
      if (!engine || !text) return;

      lastPlaybackRef.current = { article, text };
      setNowPlaying(nowPlayingFromArticle(article));
      setScrollLocked(true);

      const { status } = engine.getState();
      const prepared = preparedRef.current;
      const alreadyPrepared =
        prepared?.uri === article.uri &&
        prepared.text === text &&
        status !== "idle" &&
        status !== "error";
      if (alreadyPrepared) {
        engine.play();
        return;
      }

      // `prepare` streams audio and starts playback from the first sentence.
      preparedRef.current = { uri: article.uri, text };
      void engine.prepare(text, getVoicePromise(article));
    },
    [getVoicePromise],
  );

  // Narration (with embedded Bluesky posts resolved) is async; memoize per URI
  // so a full read and a later play-from-selection don't refetch.
  const getNarration = useCallback((article: ArticleDetail) => {
    const cache = narrationCacheRef.current;
    let promise = cache.get(article.uri);
    if (!promise) {
      promise = buildNarration(article);
      cache.set(article.uri, promise);
    }
    return promise;
  }, []);

  const playArticle = useCallback(
    (article: ArticleDetail) => {
      void getNarration(article).then((text) => {
        if (text) startPlayback(article, text);
      });
    },
    [getNarration, startPlayback],
  );

  const playFromSelection = useCallback(
    (article: ArticleDetail, selectionText: string) => {
      void getNarration(article).then((fullText) => {
        startPlayback(
          article,
          textFromSelection(fullText ?? "", selectionText),
        );
      });
    },
    [getNarration, startPlayback],
  );

  const retry = useCallback(() => {
    const last = lastPlaybackRef.current;
    if (last) startPlayback(last.article, last.text);
  }, [startPlayback]);

  const getSentences = useCallback(
    () => engineRef.current?.getSentences() ?? [],
    [],
  );

  const getProgress = useCallback(
    () => engineRef.current?.getProgress() ?? null,
    [],
  );

  const toggle = useCallback(() => {
    engineRef.current?.toggle();
  }, []);

  const skip = useCallback((seconds: number) => {
    engineRef.current?.skip(seconds);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    engineRef.current?.seekTo(seconds);
  }, []);

  const setRate = useCallback((rate: number) => {
    engineRef.current?.setRate(rate);
  }, []);

  const stop = useCallback(() => {
    preparedRef.current = null;
    setNowPlaying(null);
    setScrollLocked(true);
    engineRef.current?.reset();
  }, []);

  const unlockScroll = useCallback(() => {
    setScrollLocked((locked) => (locked ? false : locked));
  }, []);

  const lockScroll = useCallback(() => {
    setScrollLocked(true);
  }, []);

  const value = useMemo<PageReaderContextValue>(
    () => ({
      state,
      active: state.status !== "idle",
      nowPlaying,
      playArticle,
      playFromSelection,
      retry,
      getSentences,
      getProgress,
      toggle,
      skip,
      seekTo,
      setRate,
      stop,
      scrollLocked,
      unlockScroll,
      lockScroll,
    }),
    [
      state,
      nowPlaying,
      playArticle,
      playFromSelection,
      retry,
      getSentences,
      getProgress,
      toggle,
      skip,
      seekTo,
      setRate,
      stop,
      scrollLocked,
      unlockScroll,
      lockScroll,
    ],
  );

  return <PageReaderContext value={value}>{children}</PageReaderContext>;
}
