CREATE TABLE "publication_corecommends" (
	"publication_uri" text NOT NULL,
	"related_publication_uri" text NOT NULL,
	"co_recommender_count" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"recomputed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_corecommends_publication_uri_related_publication_uri_pk" PRIMARY KEY("publication_uri","related_publication_uri")
);
--> statement-breakpoint
ALTER TABLE "publication_corecommends" ADD CONSTRAINT "publication_corecommends_publication_uri_publications_uri_fk" FOREIGN KEY ("publication_uri") REFERENCES "public"."publications"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_corecommends" ADD CONSTRAINT "publication_corecommends_related_publication_uri_publications_uri_fk" FOREIGN KEY ("related_publication_uri") REFERENCES "public"."publications"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publication_corecomm_rank_idx" ON "publication_corecommends" USING btree ("publication_uri","score" DESC NULLS LAST);