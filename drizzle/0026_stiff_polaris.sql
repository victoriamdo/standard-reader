CREATE TABLE "feedback_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "userinput_feedback_enabled" boolean;--> statement-breakpoint
ALTER TABLE "feedback_draft" ADD CONSTRAINT "feedback_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_draft_user_idx" ON "feedback_draft" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_draft_expires_idx" ON "feedback_draft" USING btree ("expires_at");