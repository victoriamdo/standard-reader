import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { Db, Schema } from "#/integrations/tanstack-query/api-shapes";
import { publicationDisplayName } from "#/integrations/tanstack-query/api-shapes";
import type {
  ActorMentionMap,
  DocumentMentionMap,
  InlineMentionRefs,
  InlineMentions,
  PublicationMentionMap,
} from "#/lib/leaflet/publication-mentions";
import {
  mentionUrlKey,
  normalizeMentionUrl,
} from "#/lib/leaflet/publication-mentions";
import { cdnImageUrl } from "#/server/atproto/blob";

async function resolvePublications(
  db: Db,
  schema: Schema,
  atUris: Array<string>,
  urls: Array<string>,
): Promise<PublicationMentionMap> {
  const p = schema.publications;
  const normalizedUrls = [
    ...new Set(urls.map((url) => normalizeMentionUrl(url))),
  ];

  const predicates = [];
  if (atUris.length > 0) predicates.push(inArray(p.uri, atUris));
  if (normalizedUrls.length > 0) {
    // Stored `url` is normalized on ingest; `rtrim` guards legacy slash variants.
    predicates.push(inArray(sql`rtrim(${p.url}, '/')`, normalizedUrls));
  }
  if (predicates.length === 0) return {};

  const rows = await db
    .select({
      uri: p.uri,
      did: p.did,
      rkey: p.rkey,
      name: p.name,
      url: p.url,
      iconCid: p.iconCid,
    })
    .from(p)
    .where(and(eq(p.deleted, false), or(...predicates)));

  const map: PublicationMentionMap = {};
  for (const row of rows) {
    const mention = {
      atUri: row.uri,
      did: row.did,
      rkey: row.rkey,
      name: publicationDisplayName(row.name, row.url),
      // Icons may carry alpha (square logos on themed backgrounds); keep PNG.
      iconUrl: row.iconCid ? cdnImageUrl(row.did, row.iconCid, "png") : null,
    };
    map[row.uri] = mention;
    map[mentionUrlKey(row.url)] = mention;
  }
  return map;
}

async function resolveDocuments(
  db: Db,
  schema: Schema,
  atUris: Array<string>,
): Promise<DocumentMentionMap> {
  if (atUris.length === 0) return {};
  const d = schema.documents;
  const rows = await db
    .select({ uri: d.uri, did: d.did, rkey: d.rkey, title: d.title })
    .from(d)
    .where(and(eq(d.deleted, false), inArray(d.uri, atUris)));

  const map: DocumentMentionMap = {};
  for (const row of rows) {
    map[row.uri] = {
      atUri: row.uri,
      did: row.did,
      rkey: row.rkey,
      title: row.title,
    };
  }
  return map;
}

async function resolveActors(
  db: Db,
  schema: Schema,
  dids: Array<string>,
): Promise<ActorMentionMap> {
  if (dids.length === 0) return {};
  const pr = schema.profiles;
  const rows = await db
    .select({ did: pr.did, handle: pr.handle, avatarUrl: pr.avatarUrl })
    .from(pr)
    .where(inArray(pr.did, dids));

  const map: ActorMentionMap = {};
  for (const row of rows) {
    map[row.did] = {
      did: row.did,
      handle: row.handle,
      avatarUrl: row.avatarUrl,
    };
  }
  return map;
}

/**
 * Resolve inline Leaflet references — publication `#atMention`s / homepage
 * `#link`s and actor `#didMention`s — to Standard Reader publications and
 * profiles, so the reader can render them as avatar chips linking to
 * `/p/$did/$rkey` and `/u/$did` (matching how Leaflet renders them) instead of
 * bare text or off-site links. Resolved lazily on the client after the article
 * paints, so it never blocks the article's initial (SSR) render.
 */
export async function resolveInlineMentions(
  db: Db,
  schema: Schema,
  refs: InlineMentionRefs,
): Promise<InlineMentions> {
  const [publications, documents, actors] = await Promise.all([
    resolvePublications(
      db,
      schema,
      refs.publicationAtUris,
      refs.publicationUrls,
    ),
    resolveDocuments(db, schema, refs.documentAtUris),
    resolveActors(db, schema, refs.actorDids),
  ]);
  return { publications, documents, actors };
}
