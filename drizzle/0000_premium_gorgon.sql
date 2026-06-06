CREATE TABLE "profiles" (
	"did" text PRIMARY KEY NOT NULL,
	"handle" text,
	"pds" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_name" text,
	"description" text,
	"avatar_url" text,
	"banner_url" text,
	"bsky_profile_uri" text,
	"bsky_profile_cid" text,
	"profile_fetched_at" timestamp with time zone,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"uri" text PRIMARY KEY NOT NULL,
	"cid" text,
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"icon_cid" text,
	"icon_mime" text,
	"icon_url" text,
	"theme_accent" text,
	"theme_background" text,
	"theme_foreground" text,
	"theme_accent_foreground" text,
	"theme_json" jsonb,
	"show_in_discover" boolean DEFAULT true NOT NULL,
	"topic" text,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"verification_checked_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')) STORED,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_contributors" (
	"document_uri" text NOT NULL,
	"did" text NOT NULL,
	"role" text,
	"display_name" text,
	CONSTRAINT "document_contributors_document_uri_did_pk" PRIMARY KEY("document_uri","did")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"uri" text PRIMARY KEY NOT NULL,
	"cid" text,
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"title" text NOT NULL,
	"site_uri" text NOT NULL,
	"publication_uri" text,
	"path" text,
	"canonical_url" text,
	"description" text,
	"text_content" text,
	"content_json" jsonb,
	"content_format" text,
	"cover_image_cid" text,
	"cover_image_mime" text,
	"cover_image_url" text,
	"tags" text[],
	"featured" boolean DEFAULT false NOT NULL,
	"bsky_post_uri" text,
	"bsky_post_cid" text,
	"published_at" timestamp with time zone NOT NULL,
	"record_updated_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B') || setweight(to_tsvector('english', coalesce(text_content, '')), 'C')) STORED,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommends" (
	"uri" text PRIMARY KEY NOT NULL,
	"cid" text,
	"recommender_did" text NOT NULL,
	"rkey" text NOT NULL,
	"document_uri" text NOT NULL,
	"document_did" text,
	"created_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"uri" text PRIMARY KEY NOT NULL,
	"cid" text,
	"subscriber_did" text NOT NULL,
	"rkey" text NOT NULL,
	"publication_uri" text NOT NULL,
	"publication_did" text,
	"created_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_cosubscriptions" (
	"publication_uri" text NOT NULL,
	"related_publication_uri" text NOT NULL,
	"co_subscriber_count" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"recomputed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_cosubscriptions_publication_uri_related_publication_uri_pk" PRIMARY KEY("publication_uri","related_publication_uri")
);
--> statement-breakpoint
CREATE TABLE "publication_stats" (
	"publication_uri" text PRIMARY KEY NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"document_count" integer DEFAULT 0 NOT NULL,
	"recommend_count" integer DEFAULT 0 NOT NULL,
	"last_document_at" timestamp with time zone,
	"documents_7d" integer DEFAULT 0 NOT NULL,
	"subscribers_7d" integer DEFAULT 0 NOT NULL,
	"recommends_7d" integer DEFAULT 0 NOT NULL,
	"trending_score" double precision DEFAULT 0 NOT NULL,
	"trending_window_start" timestamp with time zone,
	"recomputed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_dead_letter" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" bigint,
	"uri" text,
	"collection" text,
	"action" text,
	"payload" jsonb,
	"error" text,
	"retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_state" (
	"id" text PRIMARY KEY NOT NULL,
	"last_event_id" bigint,
	"last_event_at" timestamp with time zone,
	"events_processed" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_repos" (
	"did" text PRIMARY KEY NOT NULL,
	"reason" text,
	"added_to_tap_at" timestamp with time zone,
	"backfill_state" text DEFAULT 'pending' NOT NULL,
	"last_seen_rev" text,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_contributors" ADD CONSTRAINT "document_contributors_document_uri_documents_uri_fk" FOREIGN KEY ("document_uri") REFERENCES "public"."documents"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_cosubscriptions" ADD CONSTRAINT "publication_cosubscriptions_publication_uri_publications_uri_fk" FOREIGN KEY ("publication_uri") REFERENCES "public"."publications"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_cosubscriptions" ADD CONSTRAINT "publication_cosubscriptions_related_publication_uri_publications_uri_fk" FOREIGN KEY ("related_publication_uri") REFERENCES "public"."publications"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_stats" ADD CONSTRAINT "publication_stats_publication_uri_publications_uri_fk" FOREIGN KEY ("publication_uri") REFERENCES "public"."publications"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_handle_idx" ON "profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "publications_did_idx" ON "publications" USING btree ("did");--> statement-breakpoint
CREATE INDEX "publications_name_idx" ON "publications" USING btree ("name");--> statement-breakpoint
CREATE INDEX "publications_discover_idx" ON "publications" USING btree ("show_in_discover","deleted");--> statement-breakpoint
CREATE INDEX "publications_topic_idx" ON "publications" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "publications_url_idx" ON "publications" USING btree ("url");--> statement-breakpoint
CREATE INDEX "publications_search_idx" ON "publications" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "document_contributors_did_idx" ON "document_contributors" USING btree ("did");--> statement-breakpoint
CREATE INDEX "documents_did_idx" ON "documents" USING btree ("did");--> statement-breakpoint
CREATE INDEX "documents_publication_published_idx" ON "documents" USING btree ("publication_uri","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_published_idx" ON "documents" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_featured_idx" ON "documents" USING btree ("featured","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_site_idx" ON "documents" USING btree ("site_uri");--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "recommends_document_idx" ON "recommends" USING btree ("document_uri");--> statement-breakpoint
CREATE INDEX "recommends_recommender_idx" ON "recommends" USING btree ("recommender_did");--> statement-breakpoint
CREATE UNIQUE INDEX "recommends_edge_idx" ON "recommends" USING btree ("recommender_did","document_uri");--> statement-breakpoint
CREATE INDEX "subscriptions_publication_idx" ON "subscriptions" USING btree ("publication_uri");--> statement-breakpoint
CREATE INDEX "subscriptions_subscriber_idx" ON "subscriptions" USING btree ("subscriber_did");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_edge_idx" ON "subscriptions" USING btree ("subscriber_did","publication_uri");--> statement-breakpoint
CREATE INDEX "publication_cosub_rank_idx" ON "publication_cosubscriptions" USING btree ("publication_uri","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "publication_stats_subscribers_idx" ON "publication_stats" USING btree ("subscriber_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "publication_stats_active_idx" ON "publication_stats" USING btree ("last_document_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "publication_stats_trending_idx" ON "publication_stats" USING btree ("trending_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingest_dead_letter_collection_idx" ON "ingest_dead_letter" USING btree ("collection");--> statement-breakpoint
CREATE INDEX "tracked_repos_state_idx" ON "tracked_repos" USING btree ("backfill_state");