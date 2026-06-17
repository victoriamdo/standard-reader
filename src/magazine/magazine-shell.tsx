import type { CollectionTheme } from "#/lib/collections/theme";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import {
  buildMagazinePalette,
  magazinePaletteCss,
  magazinePaletteInlineStyle,
} from "#/lib/collections/radix-theme";
import { useLayoutEffect, useMemo } from "react";

import { readMagazineDark } from "./dark-mode";
import { googleFontsHref, magazineThemeStyle } from "./theme-vars";

function magazineBodyBackdrop(
  theme: CollectionTheme | null | undefined,
  dark: boolean,
): string {
  const palette = buildMagazinePalette(theme);
  const vars = palette ? (dark ? palette.dark : palette.light) : null;
  return (
    vars?.["--ink"] ?? (dark ? "oklch(0.93 0.012 80)" : "oklch(0.245 0.012 60)")
  );
}

/** Route head: paint html/body before React mounts the magazine shell. */
export function magazineRouteBackdropStyle(
  theme: CollectionTheme | null | undefined,
): { type: "text/css"; children: string } | null {
  const dark = readMagazineDark(theme);
  const bg = magazineBodyBackdrop(theme, dark);
  return {
    type: "text/css",
    children: `html,body{background-color:${bg}!important;overflow:hidden}`,
  };
}

let magazineShellMountCount = 0;
let savedDocumentChrome: {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyBackgroundColor: string;
} | null = null;

function syncDocumentBackdrop(
  theme: CollectionTheme | null | undefined,
  dark: boolean,
) {
  if (globalThis.document === undefined) return;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.backgroundColor = magazineBodyBackdrop(theme, dark);
}

/** Themed `.mag` root — shared by the loading shell and the live viewer. */
export function MagazineShell({
  theme,
  dark,
  children,
  className,
  style,
  ...rest
}: {
  theme: CollectionTheme | null | undefined;
  dark?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & HTMLAttributes<HTMLDivElement>) {
  const themePalette = useMemo(() => buildMagazinePalette(theme), [theme]);
  const paletteCss = themePalette ? magazinePaletteCss(themePalette) : null;
  const fontsHref = googleFontsHref(theme);
  const isDark = dark ?? readMagazineDark(theme);
  const isThemed = Boolean(theme?.accent);

  syncDocumentBackdrop(theme, isDark);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (magazineShellMountCount === 0) {
      savedDocumentChrome = {
        htmlOverflow: html.style.overflow,
        bodyOverflow: body.style.overflow,
        bodyBackgroundColor: body.style.backgroundColor,
      };
    }
    magazineShellMountCount += 1;
    return () => {
      magazineShellMountCount -= 1;
      if (magazineShellMountCount === 0 && savedDocumentChrome) {
        const saved = savedDocumentChrome;
        savedDocumentChrome = null;
        requestAnimationFrame(() => {
          if (magazineShellMountCount > 0) return;
          html.style.overflow = saved.htmlOverflow;
          body.style.overflow = saved.bodyOverflow;
          body.style.backgroundColor = saved.bodyBackgroundColor;
        });
      }
    };
  }, []);

  useLayoutEffect(() => {
    syncDocumentBackdrop(theme, isDark);
  }, [theme, isDark]);

  return (
    <div
      className={`mag ${isDark ? "is-dark" : ""} ${isThemed ? "is-themed" : ""}${className ? ` ${className}` : ""}`}
      style={{
        colorScheme: isDark ? "dark" : "light",
        ...magazineThemeStyle(theme),
        ...magazinePaletteInlineStyle(theme, isDark),
        ...style,
      }}
      {...rest}
    >
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      {paletteCss ? (
        // eslint-disable-next-line react/no-danger
        <style dangerouslySetInnerHTML={{ __html: paletteCss }} />
      ) : null}
      {children}
    </div>
  );
}

/** Centered loading chrome — mount inside {@link MagazineShell}. */
export function MagazineBuilding({ label }: { label: string }) {
  return (
    <div className="building" aria-busy="true" aria-label={label}>
      <div>
        <div className="spin" />
        {label}
      </div>
    </div>
  );
}
