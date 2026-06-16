import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";

/** Opener metadata derived from an article, for the magazine art direction. */
export interface MagMeta {
  id: string;
  did: string;
  rkey: string;
  title: string;
  dek: string | null;
  author: string;
  handle: string | null;
  date: string;
  minutes: number;
  pubName: string;
  topic: string;
  coverImageUrl: string | null;
}

/** A composed feature: opener metadata + the full article record to render. */
export interface MagFeature {
  meta: MagMeta;
  detail: ArticleDetail;
}

export interface MagIssue {
  name: string;
  no: string;
  sub: string;
  ownerHandle: string | null;
  features: Array<MagFeature>;
}
