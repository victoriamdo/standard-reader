CREATE TABLE "quote_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"document_uri" text NOT NULL,
	"quote_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "quote_shares_document_uri_idx" ON "quote_shares" USING btree ("document_uri");