import type { Font } from "satori";

import { Resvg } from "@resvg/resvg-js";
import { SITE_NAME, SITE_TAGLINE } from "#/lib/site-metadata";
import { loadOgFonts } from "#/server/og/fonts";
import satori from "satori";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const colors = {
  background: "#f9f7f2",
  foreground: "#3e3934",
  muted: "#8a847a",
  accent: "#bd5633",
  line: "#d9d2c8",
} as const;

function siteOgMarkup() {
  return (
    <div
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Newsreader",
        height: "100%",
        justifyContent: "center",
        padding: "4rem 5rem",
        width: "100%",
      }}
    >
      <div
        style={{
          borderLeftColor: colors.accent,
          borderLeftStyle: "solid",
          borderLeftWidth: 4,
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          paddingLeft: "2.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Newsreader",
            fontSize: 88,
            fontWeight: 600,
            letterSpacing: -1.5,
            lineHeight: "92px",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            color: colors.muted,
            display: "flex",
            fontFamily: "Newsreader",
            fontSize: 34,
            fontWeight: 400,
            lineHeight: "44px",
            maxWidth: 760,
          }}
        >
          {SITE_TAGLINE}
        </div>
      </div>

      <div
        style={{
          borderTopColor: colors.line,
          borderTopStyle: "solid",
          borderTopWidth: 1,
          color: colors.muted,
          display: "flex",
          fontFamily: "Archivo",
          fontSize: 22,
          letterSpacing: 0.4,
          marginTop: "auto",
          paddingTop: "2rem",
          textTransform: "uppercase",
        }}
      >
        standard.site · Atmosphere
      </div>
    </div>
  );
}

export async function renderSiteOgImage(): Promise<Uint8Array> {
  const fonts = await loadOgFonts();
  const svg = await satori(siteOgMarkup(), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts as Array<Font>,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
  });

  return resvg.render().asPng();
}
