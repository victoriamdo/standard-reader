import type { CollectionTheme } from "#/lib/collections/theme";
import type { HTMLAttributes, ReactNode } from "react";

import {
  buildMagazinePalette,
  magazinePaletteCss,
  themePrefersDark,
} from "#/lib/collections/radix-theme";
import { useMemo } from "react";

import { googleFontsHref, magazineThemeStyle } from "./theme-vars";

/** Themed `.mag` root — shared by the loading shell and the live viewer. */
export function MagazineShell({
  theme,
  dark,
  children,
  className,
  ...rest
}: {
  theme: CollectionTheme | null | undefined;
  dark?: boolean;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const themePalette = useMemo(() => buildMagazinePalette(theme), [theme]);
  const paletteCss = themePalette ? magazinePaletteCss(themePalette) : null;
  const fontsHref = googleFontsHref(theme);
  const isDark = dark ?? themePrefersDark(theme);
  const isThemed = Boolean(theme?.accent);

  return (
    <div
      className={`mag ${isDark ? "is-dark" : ""} ${isThemed ? "is-themed" : ""}${className ? ` ${className}` : ""}`}
      style={magazineThemeStyle(theme)}
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
