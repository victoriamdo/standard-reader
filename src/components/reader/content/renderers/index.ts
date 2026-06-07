import { LEAFLET_CONTENT } from "#/lib/leaflet/types";

import type { ContentRenderer } from "../types";

import { LeafletContentRenderer } from "./leaflet-content";

/** Registry of `site.standard.document` content union renderers keyed by `$type`. */
export const CONTENT_RENDERERS: Record<string, ContentRenderer> = {
  [LEAFLET_CONTENT]: LeafletContentRenderer,
};
