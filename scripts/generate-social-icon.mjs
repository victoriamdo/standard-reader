/**
 * Regenerate PWA / social icons from the Newsreader "S" glyph.
 *
 * Extracts the outline from the Newsreader variable font at the same instance
 * the favicon renders with in browsers (opsz 56, wght 500), centers its ink
 * bounding box in the canvas, and renders PNGs with resvg.
 *
 * Outputs:
 * - public/icon-320.{svg,png} — social / OG square
 * - public/icon-192.png, public/icon-512.png — manifest install icons
 * - public/apple-touch-icon.png — iOS home screen (180×180)
 *
 * Run: node scripts/generate-social-icon.mjs
 */
import { Resvg } from "@resvg/resvg-js";
import * as fontkit from "fontkit";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKGROUND = "#fcfbf6"; // manifest background_color
const GLYPH_COLOR = "#c2502b"; // manifest theme_color == favicon oklch(0.575 0.155 38)
// Favicon is font-size 56 in a 64 viewBox; keep the same ink-height ratio.
const FAVICON_FONT_RATIO = 56 / 64;
const FONT_URL =
  "https://github.com/google/fonts/raw/main/ofl/newsreader/Newsreader%5Bopsz%2Cwght%5D.ttf";

/** @type {Array<{ size: number; png: string; svg?: string }>} */
const OUTPUTS = [
  { size: 320, png: "icon-320.png", svg: "icon-320.svg" },
  { size: 512, png: "icon-512.png" },
  { size: 192, png: "icon-192.png" },
  { size: 180, png: "apple-touch-icon.png" },
];

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(rootDir, "public");
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

function buildSvg(size) {
  const inkRatio = (inkHeight / instance.unitsPerEm) * FAVICON_FONT_RATIO;
  const scale = (size * inkRatio) / inkHeight;
  const width = inkWidth * scale;
  const height = inkHeight * scale;
  const tx = (size - width) / 2 - bbox.minX * scale;
  const ty = (size - height) / 2 + bbox.maxY * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}" />
  <path transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)} ${-scale.toFixed(6)})" fill="${GLYPH_COLOR}" d="${glyph.path.toSVG()}" />
</svg>
`;
}

for (const { size, png, svg } of OUTPUTS) {
  const svgContent = buildSvg(size);
  const pngPath = join(publicDir, png);
  await writeFile(pngPath, new Resvg(svgContent).render().asPng());
  console.log(`Wrote ${pngPath}`);

  if (svg) {
    const svgPath = join(publicDir, svg);
    await writeFile(svgPath, svgContent);
    console.log(`Wrote ${svgPath}`);
  }
}
