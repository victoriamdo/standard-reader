"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import * as stylex from "@stylexjs/stylex";
import { Link as LinkIcon, Play, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "#/design-system/icon-button";
import { MenuItem, MenuSeparator } from "#/design-system/menu";
import { animationDuration } from "#/design-system/theme/animations.stylex";
import { uiColor } from "#/design-system/theme/color.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import { shadow } from "#/design-system/theme/shadow.stylex";
import { toasts } from "#/design-system/toast";
import { Toolbar, ToolbarGroup } from "#/design-system/toolbar";
import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";
import { quoteShareApi } from "#/integrations/tanstack-query/api-quote-share.functions";
import { usePageReader } from "#/lib/page-reader/page-reader-context";
import { buildQuoteShareUrl, normalizeQuoteText } from "#/lib/quote-share";

import { primaryAuthor } from "./format";
import { LinkShareMenu } from "./link-share-menu";
import { SaveToCollectionDialog } from "./save-to-collection-dialog";

const MIN_SELECTION_LENGTH = 3;
const SYNC_SELECTION_DELAY_MS = 0;

const styles = stylex.create({
  anchor: {
    position: "fixed",
    transform: "translate(-50%, calc(-100% - 12px))",
    zIndex: 1000,
    insetInlineStart: 0,
    top: 0,
  },
  shell: {
    borderColor: uiColor.border2,
    borderRadius: radius.sm,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    boxShadow: shadow.lg,
    transitionDuration: animationDuration.fast,
    transitionProperty: "opacity, transform",
    transitionTimingFunction: "ease-out",
    paddingBottom: verticalSpace.xs,
    paddingInlineStart: horizontalSpace.xs,
    paddingInlineEnd: horizontalSpace.xs,
    paddingTop: verticalSpace.xs,
  },
  shellVisible: {
    opacity: 1,
    transform: "scale(1)",
  },
});

interface ToolbarState {
  text: string;
  x: number;
  y: number;
}

function selectionWithinRoot(
  selection: Selection,
  root: HTMLElement,
): Range | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const text = normalizeQuoteText(selection.toString());
  if (text.length < MIN_SELECTION_LENGTH) return null;
  return range;
}

function toolbarPosition(range: Range): { x: number; y: number } {
  const rect = range.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top,
  };
}

function eventTargetsToolbar(
  event: Event,
  anchor: HTMLElement | null,
): boolean {
  if (!anchor) return false;
  const path = event.composedPath();
  return path.includes(anchor);
}

export function TextSelectionToolbar({
  rootRef,
  article,
  documentUri,
  did,
  rkey,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  article: ArticleDetail;
  documentUri: string;
  did: string;
  rkey: string;
}) {
  const { t } = useLingui();
  const anchorRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  const isSelectingRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  );
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharePending, setSharePending] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [saveDialog, setSaveDialog] = useState<"margin" | "semble" | null>(
    null,
  );
  const { playFromSelection } = usePageReader();

  const hideToolbar = useCallback(() => {
    pinnedRef.current = false;
    setShareMenuOpen(false);
    setToolbar(null);
  }, []);

  const openToolbar = useCallback((range: Range, text: string) => {
    const { x, y } = toolbarPosition(range);
    pinnedRef.current = true;
    setToolbar({ text, x, y });
  }, []);

  const syncToolbarToSelection = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const selection = globalThis.getSelection();
    if (!selection) {
      hideToolbar();
      return;
    }

    const range = selectionWithinRoot(selection, root);
    if (!range) {
      hideToolbar();
      return;
    }

    const text = normalizeQuoteText(range.toString());
    if (!text) {
      hideToolbar();
      return;
    }

    openToolbar(range, text);
  }, [hideToolbar, openToolbar, rootRef]);

  const scheduleSyncToolbarToSelection = useCallback(() => {
    if (syncTimerRef.current !== null) {
      globalThis.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = globalThis.setTimeout(() => {
      syncTimerRef.current = null;
      syncToolbarToSelection();
    }, SYNC_SELECTION_DELAY_MS);
  }, [syncToolbarToSelection]);

  // Clear the share URL when the selection changes so a fresh one is created
  // only on the next explicit share action (not automatically on selection).
  useEffect(() => {
    setShareUrl(null);
    setSharePending(false);
  }, [toolbar]);

  const ensureShareUrl = useCallback(async (): Promise<string | null> => {
    if (!toolbar) return null;
    if (shareUrl) return shareUrl;
    setSharePending(true);
    try {
      const { id } = await quoteShareApi.createQuoteShare({
        data: { documentUri, quote: toolbar.text },
      });
      const url = buildQuoteShareUrl(did, rkey, id);
      setShareUrl(url);
      return url;
    } catch {
      toasts.add(
        {
          title: t`Couldn't create share link`,
          variant: "critical",
        },
        { timeout: 3000 },
      );
      return null;
    } finally {
      setSharePending(false);
    }
  }, [did, documentUri, rkey, shareUrl, t, toolbar]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (event: Event) => {
      if (eventTargetsToolbar(event, anchorRef.current)) return;
      isSelectingRef.current = true;
      hideToolbar();
    };

    const onPointerUp = (event: Event) => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      if (eventTargetsToolbar(event, anchorRef.current)) return;
      scheduleSyncToolbarToSelection();
    };

    const onSelectionChange = () => {
      if (isSelectingRef.current) {
        hideToolbar();
        return;
      }
      scheduleSyncToolbarToSelection();
    };

    const onScroll = () => {
      if (isSelectingRef.current) return;
      hideToolbar();
      globalThis.getSelection()?.removeAllRanges();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideToolbar();
    };

    root.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("keydown", onKeyDown);
      if (syncTimerRef.current !== null) {
        globalThis.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [hideToolbar, rootRef, scheduleSyncToolbarToSelection]);

  useEffect(() => {
    if (!toolbar) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!pinnedRef.current) return;
      if (shareMenuOpen) return;
      if (eventTargetsToolbar(event, anchorRef.current)) return;
      hideToolbar();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [hideToolbar, shareMenuOpen, toolbar]);

  const onCopyLinkPress = useCallback(async () => {
    const url = await ensureShareUrl();
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => {
      toasts.add(
        {
          title: t`Link copied`,
          variant: "success",
        },
        {
          timeout: 2000,
        },
      );
    });
  }, [ensureShareUrl, t]);

  const dismissAfterShare = useCallback(() => {
    hideToolbar();
    globalThis.getSelection()?.removeAllRanges();
  }, [hideToolbar]);

  const [savePassage, setSavePassage] = useState<string | null>(null);

  const openSaveDialog = useCallback(
    (app: "margin" | "semble") => {
      if (!toolbar) return;
      setSavePassage(toolbar.text);
      setSaveDialog(app);
      dismissAfterShare();
    },
    [dismissAfterShare, toolbar],
  );

  // Decoupled from `ensureShareUrl` (which reads live `toolbar` state) since
  // the save dialog stays open — and may complete its OAuth round-trip —
  // after the toolbar (and its selection) has already been dismissed.
  const ensureSaveQuoteShareUrl = useCallback(async (): Promise<
    string | null
  > => {
    if (!savePassage) return null;
    try {
      const { id } = await quoteShareApi.createQuoteShare({
        data: { documentUri, quote: savePassage },
      });
      return buildQuoteShareUrl(did, rkey, id);
    } catch {
      toasts.add(
        { title: t`Couldn't create share link`, variant: "critical" },
        { timeout: 3000 },
      );
      return null;
    }
  }, [did, documentUri, rkey, savePassage, t]);

  const onPlayPress = useCallback(() => {
    if (!toolbar) return;
    playFromSelection(article, toolbar.text);
    hideToolbar();
    globalThis.getSelection()?.removeAllRanges();
  }, [article, hideToolbar, playFromSelection, toolbar]);

  return (
    <>
      {toolbar && globalThis.document !== undefined
        ? createPortal(
            <div
              ref={anchorRef}
              {...stylex.props(styles.anchor)}
              style={{ left: toolbar.x, top: toolbar.y }}
            >
              <Toolbar
                aria-label={t`Text selection actions`}
                style={[styles.shell, styles.shellVisible]}
              >
                <ToolbarGroup aria-label={t`Listen`}>
                  <IconButton
                    variant="tertiary"
                    size="lg"
                    label={t`Read from here`}
                    onPress={onPlayPress}
                  >
                    <Play size={18} />
                  </IconButton>
                </ToolbarGroup>
                <ToolbarGroup aria-label={t`Share`}>
                  <IconButton
                    variant="tertiary"
                    size="lg"
                    label={t`Copy link`}
                    isDisabled={sharePending}
                    onPress={onCopyLinkPress}
                  >
                    <LinkIcon size={18} />
                  </IconButton>
                  <LinkShareMenu
                    getLinkUrl={() => shareUrl}
                    ensureLinkUrl={ensureShareUrl}
                    isOpen={shareMenuOpen}
                    onOpenChange={setShareMenuOpen}
                    onShare={dismissAfterShare}
                    trigger={
                      <IconButton variant="tertiary" size="lg" label={t`Share`}>
                        <Share2 size={18} />
                      </IconButton>
                    }
                  >
                    <MenuSeparator />
                    <MenuItem
                      onPress={() => openSaveDialog("margin")}
                      textValue={t`Save to Margin…`}
                    >
                      <Trans>Save to Margin…</Trans>
                    </MenuItem>
                    <MenuItem
                      onPress={() => openSaveDialog("semble")}
                      textValue={t`Save to Semble…`}
                    >
                      <Trans>Save to Semble…</Trans>
                    </MenuItem>
                  </LinkShareMenu>
                </ToolbarGroup>
              </Toolbar>
            </div>,
            document.body,
          )
        : null}
      {/* Rendered independent of `toolbar` — the save dialog (and its OAuth
          round-trip) must stay mounted even after the toolbar/selection is
          dismissed. */}
      <SaveToCollectionDialog
        app="margin"
        isOpen={saveDialog === "margin"}
        onOpenChange={(open) => setSaveDialog(open ? "margin" : null)}
        articleTitle={article.title}
        getStandardReaderUrl={() => globalThis.location.href}
        originalUrl={article.canonicalUrl}
        passage={savePassage ?? undefined}
      />
      <SaveToCollectionDialog
        app="semble"
        isOpen={saveDialog === "semble"}
        onOpenChange={(open) => setSaveDialog(open ? "semble" : null)}
        articleTitle={article.title}
        getStandardReaderUrl={() => globalThis.location.href}
        originalUrl={article.canonicalUrl}
        articleDescription={article.description}
        articleAuthor={primaryAuthor(article)}
        articleSiteName={article.publication?.name}
        articleImageUrl={article.coverImageUrl}
        passage={savePassage ?? undefined}
        ensureQuoteShareUrl={ensureSaveQuoteShareUrl}
      />
    </>
  );
}
