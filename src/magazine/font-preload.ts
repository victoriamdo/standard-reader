import type { CollectionTheme } from "#/lib/collections/theme";

import { googleFontsHref } from "./theme-vars";

export type MagazineFontHeadLink = {
  rel: string;
  href: string;
  as?: string;
  type?: string;
  crossOrigin?: "anonymous";
};

/** Stylesheet + gstatic preconnect for a collection theme (route head). */
export function magazineThemeFontHeadLinks(
  theme: CollectionTheme | null | undefined,
): Array<MagazineFontHeadLink> {
  const href = googleFontsHref(theme);
  if (!href) return [];
  return [
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous",
    },
    { rel: "stylesheet", href },
  ];
}

const GOOGLE_FONTS_CSS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const WOFF2_RE = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g;

/** Resolve woff2 URLs from the theme's Google Fonts CSS for `<link rel="preload">`. */
export async function fetchMagazineFontPreloadLinks(
  theme: CollectionTheme | null | undefined,
): Promise<Array<MagazineFontHeadLink>> {
  const stylesheet = googleFontsHref(theme);
  if (!stylesheet) return [];

  try {
    const res = await fetch(stylesheet, {
      headers: { "User-Agent": GOOGLE_FONTS_CSS_UA },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return [];
    const css = await res.text();
    const hrefs = [
      ...new Set([...css.matchAll(WOFF2_RE)].map((match) => match[1])),
    ];
    return hrefs.slice(0, 8).map((href) => ({
      rel: "preload",
      href,
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous" as const,
    }));
  } catch {
    return [];
  }
}
