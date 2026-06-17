import type { CollectionManifest } from "#/lib/collections/manifest";

import { parseCollectionManifest } from "#/lib/collections/manifest";
import { getDocumentRecord } from "#/server/atproto/repo-records";

type RepoClient = Parameters<typeof getDocumentRecord>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * When the signed-in user owns a collection document, read the manifest
 * straight from their repo so edits (including colophon) show immediately
 * without waiting on ingest.
 */
export async function collectionManifestForOwner(
  client: RepoClient,
  ownerDid: string,
  rkey: string,
  cached: CollectionManifest | null,
): Promise<CollectionManifest | null> {
  try {
    const value = await getDocumentRecord(client, ownerDid, rkey);
    if (!isRecord(value)) return cached;
    return parseCollectionManifest(value.readerCollection) ?? cached;
  } catch {
    return cached;
  }
}
