/**
 * Retained-selection highlight (CSS Custom Highlight API).
 *
 * On touch devices the OS tears down the native text selection the instant the
 * user taps anything outside it — including our own selection toolbar. There is
 * no reliable way to stop that (preventing the default on the pointer-down does
 * not save the OS selection UI on mobile). So instead of fighting it, we keep a
 * snapshot of the chosen passage and re-paint it with a custom highlight while
 * the toolbar is in use. Like the page reader's word highlight, this paints over
 * a `Range` without mutating the DOM, so it never disturbs the article or the
 * live selection it stands in for. See the `::highlight(selection-retain)` rule
 * in `styles.css`.
 */

/** Registered name for the custom highlight (see the `::highlight()` rule). */
const HIGHLIGHT_NAME = "selection-retain";

interface HighlightLike {
  add(range: Range): void;
  clear(): void;
}

interface HighlightRegistryLike {
  set(name: string, highlight: HighlightLike): void;
  delete(name: string): void;
}

let activeHighlight: HighlightLike | null = null;

function highlightRegistry(): HighlightRegistryLike | undefined {
  return (globalThis.CSS as unknown as { highlights?: HighlightRegistryLike })
    ?.highlights;
}

/** Paint the retained selection; returns false when the browser lacks the API. */
export function setSelectionRetentionHighlight(range: Range): boolean {
  const registry = highlightRegistry();
  const Ctor = (
    globalThis as unknown as {
      Highlight?: new (...ranges: Array<Range>) => HighlightLike;
    }
  ).Highlight;
  if (!registry || !Ctor) return false;

  if (!activeHighlight) {
    activeHighlight = new Ctor();
    registry.set(HIGHLIGHT_NAME, activeHighlight);
  }
  activeHighlight.clear();
  activeHighlight.add(range);
  return true;
}

export function clearSelectionRetentionHighlight(): void {
  highlightRegistry()?.delete(HIGHLIGHT_NAME);
  activeHighlight = null;
}
