CREATE TABLE "save_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_app" text NOT NULL,
	"collection_uri" text,
	"collection_cid" text,
	"new_collection_name" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"author" text,
	"site_name" text,
	"image_url" text,
	"motivation" text,
	"passage" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "margin_save_enabled" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "semble_save_enabled" boolean;--> statement-breakpoint
ALTER TABLE "save_draft" ADD CONSTRAINT "save_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "save_draft_user_idx" ON "save_draft" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "save_draft_expires_idx" ON "save_draft" USING btree ("expires_at");