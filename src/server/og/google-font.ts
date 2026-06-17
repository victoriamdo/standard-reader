import type { Font } from "satori";

const FETCH_TIMEOUT_MS = 8000;

const TTF_UA =
  "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)";

const faceCache = new Map<string, Font>();

interface FontFaceSpec {
  weight: number;
  style: "normal" | "italic";
  url: string;
}

function parseGoogleFontCss(css: string): Array<FontFaceSpec> {
  const faces: Array<FontFaceSpec> = [];
  for (const block of css.match(/@font-face\s*{[^}]+}/g) ?? []) {
    const weightMatch = /font-weight:\s*(\d+)/.exec(block);
    const styleMatch = /font-style:\s*(normal|italic)/.exec(block);
    const urlMatch =
      /url\(([^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/.exec(block);
    if (!weightMatch || !styleMatch || !urlMatch) continue;
    faces.push({
      weight: Number(weightMatch[1]),
      style: styleMatch[1] as FontFaceSpec["style"],
      url: urlMatch[1].replaceAll(/^["']|["']$/g, ""),
    });
  }
  return faces;
}

async function fetchFontCss(family: string): Promise<string> {
  const param = encodeURIComponent(family.trim()).replaceAll("%20", "+");
  const response = await fetch(
    `https://fonts.googleapis.com/css2?family=${param}&display=swap`,
    {
      headers: { "User-Agent": TTF_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Google Fonts CSS failed for ${family}`);
  }
  return response.text();
}

async function loadFace(
  family: string,
  spec: FontFaceSpec,
): Promise<Font | null> {
  const cacheKey = `${family}:${spec.weight}:${spec.style}:${spec.url}`;
  const cached = faceCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(spec.url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const font: Font = {
      name: family,
      data: buffer,
      weight: spec.weight,
      style: spec.style,
    };
    faceCache.set(cacheKey, font);
    return font;
  } catch {
    return null;
  }
}

/** Load one or more weights/styles for a Google Font family (cached). */
export async function loadGoogleFontFaces(
  family: string,
  options: {
    weights?: Array<number>;
    styles?: Array<"normal" | "italic">;
  } = {},
): Promise<Array<Font>> {
  const weights = options.weights ?? [400];
  const styles = options.styles ?? ["normal"];

  let css: string;
  try {
    css = await fetchFontCss(family);
  } catch {
    return [];
  }

  const parsed = parseGoogleFontCss(css);
  const wanted = new Set(
    weights.flatMap((weight) => styles.map((style) => `${weight}:${style}`)),
  );

  const loaded = await Promise.all(
    parsed
      .filter((face) => wanted.has(`${face.weight}:${face.style}`))
      .map((face) => loadFace(family, face)),
  );

  return loaded.filter((face): face is Font => face != null);
}
