import * as stylex from "@stylexjs/stylex";

import { primaryColor, uiColor } from "../../design-system/theme/color.stylex";
import { fontFamily } from "../../design-system/theme/typography.stylex";

/**
 * Editorial theme for Standard Reader — a warm, paper-white, serif-for-reading
 * palette ported from the prototype's "Almanac" theme (`APP_VISION.md` §8). We
 * re-theme the design-system tokens themselves (rather than hand-rolling colors)
 * so every hip-ui component — sidebars, buttons, avatars, headings — inherits
 * the editorial look automatically. Applied once on `<body>` in `__root.tsx`.
 *
 * These are intentionally light-only fixed values; full dark-mode parity with
 * the prototype is tracked separately (TODO §6).
 */

/** Warm paper + ink neutrals (was: mauve). */
export const editorialUi = stylex.createTheme(uiColor, {
  overlayBackdrop: "oklch(0.2 0.02 60 / 0.4)",
  bg: "oklch(0.985 0.007 85)",
  bgSubtle: "oklch(0.965 0.01 84)",
  component1: "oklch(0.945 0.012 83)",
  component2: "oklch(0.92 0.014 80)",
  component3: "oklch(0.895 0.014 78)",
  border1: "oklch(0.88 0.012 75)",
  border2: "oklch(0.8 0.014 70)",
  border3: "oklch(0.72 0.016 68)",
  solid1: "oklch(0.245 0.012 60)",
  solid2: "oklch(0.4 0.012 60)",
  text1: "oklch(0.56 0.012 65)",
  text2: "oklch(0.245 0.012 60)",
  textContrast: "oklch(0.985 0.007 85)",
});

/** Terracotta accent (was: pink) — drives links, active nav, follow buttons. */
export const editorialPrimary = stylex.createTheme(primaryColor, {
  bg: "oklch(0.95 0.03 55)",
  bgSubtle: "oklch(0.965 0.022 58)",
  component1: "oklch(0.93 0.045 50)",
  component2: "oklch(0.9 0.055 48)",
  component3: "oklch(0.87 0.065 46)",
  border1: "oklch(0.8 0.09 44)",
  border2: "oklch(0.7 0.12 42)",
  border3: "oklch(0.62 0.14 40)",
  solid1: "oklch(0.575 0.155 38)",
  solid2: "oklch(0.46 0.16 36)",
  text1: "oklch(0.52 0.15 37)",
  text2: "oklch(0.46 0.16 36)",
  textContrast: "white",
});

/** Newsreader (serif/display), Archivo (sans/UI), Spline Sans Mono (mono). */
export const editorialFonts = stylex.createTheme(fontFamily, {
  title: "'Newsreader', Georgia, 'Times New Roman', serif",
  sans: "'Archivo', system-ui, -apple-system, sans-serif",
  serif: "'Newsreader', Georgia, 'Times New Roman', serif",
  mono: "'Spline Sans Mono', ui-monospace, 'SFMono-Regular', monospace",
});
