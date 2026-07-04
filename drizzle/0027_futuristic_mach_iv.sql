CREATE TABLE "upvote_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subject_uri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upvote_draft" ADD CONSTRAINT "upvote_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upvote_draft_user_idx" ON "upvote_draft" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upvote_draft_expires_idx" ON "upvote_draft" USING btree ("expires_at");