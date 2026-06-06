DROP INDEX "recommends_edge_idx";--> statement-breakpoint
DROP INDEX "subscriptions_edge_idx";--> statement-breakpoint
CREATE INDEX "recommends_edge_idx" ON "recommends" USING btree ("recommender_did","document_uri");--> statement-breakpoint
CREATE INDEX "subscriptions_edge_idx" ON "subscriptions" USING btree ("subscriber_did","publication_uri");