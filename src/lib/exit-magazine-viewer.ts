import type { RouterHistory } from "@tanstack/react-router";

import { collectionReaderPath } from "./open-collections-in-magazine";

type HistoryStack = Pick<RouterHistory, "back" | "go"> & {
  index?: number;
  entries?: Array<{ pathname?: string }>;
};

/** Leave the magazine viewer, skipping the reader page when magazine-first is on. */
export function exitMagazineViewer({
  history,
  canGoBack,
  openInMagazine,
  mode,
  did,
  rkey,
  onFallback,
}: {
  history: HistoryStack;
  canGoBack: boolean;
  openInMagazine: boolean;
  mode: "collection" | "list";
  did: string;
  rkey: string;
  onFallback: () => void;
}): void {
  if (!canGoBack) {
    onFallback();
    return;
  }

  if (openInMagazine && mode === "collection") {
    const prev = history.entries?.[(history.index ?? 0) - 1];
    if (prev?.pathname === collectionReaderPath(did, rkey)) {
      history.go(-2);
      return;
    }
  }

  history.back();
}
