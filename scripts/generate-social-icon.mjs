/**
 * Regenerate public/icon-320.svg and public/icon-320.png (social media icon).
 *
 * Extracts the "S" outline from the Newsreader variable font at the same
 * instance the favicon renders with in browsers (opsz 56, wght 500), centers
 * its ink bounding box in the canvas, and renders the PNG with resvg. No
 * webfont or headless browser needed at view time — the SVG is pure paths.
 *
 * Run: node scripts/generate-social-icon.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import * as fontkit from "fontkit";

const SIZE = 320;
const BACKGROUND = "#fcfbf6"; // manifest background_color
const GLYPH_COLOR = "#c2502b"; // manifest theme_color == favicon oklch(0.575 0.155 38)
// Favicon is font-size 56 in a 64 viewBox; keep the same ink-height ratio.
const FAVICON_FONT_RATIO = 56 / 64;
const FONT_URL =
  "https://github.com/google/fonts/raw/main/ofl/newsreader/Newsreader%5Bopsz%2Cwght%5D.ttf";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = join(tmpdir(), "standard-reader-icon-font");
const fontPath = join(fontDir, "Newsreader-variable.ttf");

await mkdir(fontDir, { recursive: true });
try {
  await readFile(fontPath);
} catch {
  const response = await fetch(FONT_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Font download failed: ${response.status}`);
  }
  await writeFile(fontPath, Buffer.from(await response.arrayBuffer()));
}

const baseFont = fontkit.openSync(fontPath);
const glyphId = baseFont.glyphForCodePoint("S".codePointAt(0)).id;
// Browsers apply optical sizing from font-size: 56px -> opsz 56.
const instance = baseFont.getVariation({ opsz: 56, wght: 500 });
const glyph = instance.getGlyph(glyphId);
const bbox = glyph.bbox;

const inkWidth = bbox.maxX - bbox.minX;
const inkHeight = bbox.maxY - bbox.minY;
// Ink height as a fraction of the em, scaled by the favicon's font-size ratio.
const inkRatio = (inkHeight / instance.unitsPerEm) * FAVICON_FONT_RATIO;
const scale = (SIZE * inkRatio) / inkHeight;
const width = inkWidth * scale;
const height = inkHeight * scale;
// Font outlines are y-up; flip with scale(s, -s) and center the ink box.
const tx = (SIZE - width) / 2 - bbox.minX * scale;
const ty = (SIZE - height) / 2 + bbox.maxY * scale;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${BACKGROUND}" />
  <path transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)} ${-scale.toFixed(6)})" fill="${GLYPH_COLOR}" d="${glyph.path.toSVG()}" />
</svg>
`;

const svgPath = join(rootDir, "public", "icon-320.svg");
const pngPath = join(rootDir, "public", "icon-320.png");
await writeFile(svgPath, svg);
await writeFile(pngPath, new Resvg(svg).render().asPng());
console.log(`Wrote ${svgPath}`);
console.log(`Wrote ${pngPath}`);
