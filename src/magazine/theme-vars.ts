import type { CollectionTheme } from "#/lib/collections/theme";
import type { CSSProperties } from "react";

/**
 * Map a collection's publication theme onto the magazine's CSS custom properties.
 * The four authored colors (background/foreground/accent/accentForeground) drive
 * everything; the muted/line/soft tints are derived with `color-mix` so a single
 * theme yields a coherent palette. Inline vars beat both the light defaults and
 * the `.is-dark` class, so a theme fully owns the surface. Fonts map to
 * `--serif` (body) and `--mag-title-font` (display).
 */
export function magazineThemeStyle(
  theme: CollectionTheme | null | undefined,
): CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = {};
  const bg = theme.background;
  const fg = theme.foreground;

  if (bg) style["--paper"] = bg;
  if (fg) style["--ink"] = fg;
  if (bg && fg) {
    style["--paper-2"] = `color-mix(in oklab, ${fg} 4%, ${bg})`;
    style["--paper-sunk"] = `color-mix(in oklab, ${fg} 8%, ${bg})`;
    style["--ink-soft"] = `color-mix(in oklab, ${fg} 72%, ${bg})`;
    style["--line"] = `color-mix(in oklab, ${fg} 14%, ${bg})`;
    style["--line-strong"] = `color-mix(in oklab, ${fg} 26%, ${bg})`;
  }
  if (theme.accent) {
    style["--accent"] = theme.accent;
    // Kickers/labels render accent-on-paper; use the accent hue directly.
    style["--accent-ink"] = theme.accent;
    if (bg) {
      style["--accent-soft"] = `color-mix(in oklab, ${theme.accent} 18%, ${bg})`;
    }
  }
  if (theme.fontBody) {
    style["--serif"] = `"${theme.fontBody}", Georgia, "Times New Roman", serif`;
  }
  if (theme.fontTitle) {
    style["--mag-title-font"] = `"${theme.fontTitle}"`;
  }
  return style as CSSProperties;
}

/** Google Fonts stylesheet URL for the theme's title/body fonts, or null. */
export function googleFontsHref(
  theme: CollectionTheme | null | undefined,
): string | null {
  if (!theme) return null;
  const families = [theme.fontTitle, theme.fontBody].filter(
    (f): f is string => Boolean(f),
  );
  if (families.length === 0) return null;
  const params = [...new Set(families)]
    .map(
      (f) =>
        `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`,
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
