CREATE TABLE "label_sync_state" (
	"labeler_did" text PRIMARY KEY NOT NULL,
	"cursor" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
