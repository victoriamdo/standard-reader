/**
 * The Standard Reader "Collection" manifest — the structured representation our
 * renderer reads. It rides along on a `site.standard.document` record under the
 * `readerCollection` extension field (no new lexicon), alongside the portable
 * `at.markpub.markdown` `content`. Theme/fonts live on the owning publication,
 * not here.
 *
 * Client-safe (no server-only imports): used by the ingest mapper, the write
 * composer, the read-model shapes, and the magazine/collection renderers.
 */

/** Record extension field that carries {@link CollectionManifest}. */
export const READER_COLLECTION_FIELD = "readerCollection";

/** An optional editorial intro. Both title and body are optional. */
export interface CollectionEditorial {
  title?: string;
  body?: string;
}

/** One curated entry: an article at-uri plus an optional explanatory note (markdown). */
export interface CollectionItem {
  /** at-uri of the included `site.standard.document`. */
  document: string;
  /** Optional markdown note shown ahead of the piece. */
  note?: string;
}

export interface CollectionManifest {
  editorial?: CollectionEditorial;
  items: Array<CollectionItem>;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseEditorial(value: unknown): CollectionEditorial | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const title = cleanString(raw.title);
  const body = cleanString(raw.body);
  if (title === undefined && body === undefined) return undefined;
  return { ...(title ? { title } : {}), ...(body ? { body } : {}) };
}

function parseItem(value: unknown): CollectionItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const document = cleanString(raw.document);
  if (!document) return null;
  const note = cleanString(raw.note);
  return { document, ...(note ? { note } : {}) };
}

/**
 * Validate and normalize a raw `readerCollection` value into a manifest, or
 * `null` when it isn't a well-formed collection (so callers can treat the
 * document as an ordinary article). Requires at least one valid item.
 */
export function parseCollectionManifest(value: unknown): CollectionManifest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.items)) return null;

  const items = raw.items
    .map(parseItem)
    .filter((item): item is CollectionItem => item != null);
  if (items.length === 0) return null;

  const editorial = parseEditorial(raw.editorial);
  return { ...(editorial ? { editorial } : {}), items };
}

/** Whether a parsed manifest carries any editorial content. */
export function hasEditorial(manifest: CollectionManifest): boolean {
  return Boolean(manifest.editorial?.title || manifest.editorial?.body);
}
