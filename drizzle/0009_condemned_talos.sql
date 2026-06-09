ALTER TABLE "documents" ADD COLUMN "backlink_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "backlink_count_prev" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "backlink_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "trending_score" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "trending_recomputed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "distinct_recommender_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_stats" ADD COLUMN "documents_prev_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_stats" ADD COLUMN "subscribers_prev_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_stats" ADD COLUMN "recommends_prev_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_stats" ADD COLUMN "backlinks_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_stats" ADD COLUMN "trending_velocity" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "documents_trending_idx" ON "documents" USING btree ("trending_score" DESC NULLS LAST);