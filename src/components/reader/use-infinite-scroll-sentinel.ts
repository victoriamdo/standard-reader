"use client";

import { useEffect, useRef } from "react";

/** Observe a sentinel inside `[data-app-scroller]` and call `loadMore` when near view. */
export function useInfiniteScrollSentinel(
  loadMore: () => void,
  enabled: boolean,
  itemCount: number,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const sentinel = ref.current;
    if (!sentinel) return;

    const root = sentinel.closest("[data-app-scroller]");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { root, rootMargin: "1200px 0px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, loadMore, itemCount]);

  return ref;
}
