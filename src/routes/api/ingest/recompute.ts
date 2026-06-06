import { createFileRoute } from "@tanstack/react-router";

import { verifyIngestAuth } from "../../../server/ingest/auth.ts";
import { recomputeDerived } from "../../../server/ingest/recompute.ts";

/**
 * Recompute derived data (publication stats + co-subscription graph). Intended
 * to be hit on a schedule (cron) after backfill catches up. Same auth as the
 * ingestion webhook.
 */
export const Route = createFileRoute("/api/ingest/recompute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyIngestAuth(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const startedAt = Date.now();
        await recomputeDerived();
        return Response.json({ ok: true, durationMs: Date.now() - startedAt });
      },
    },
  },
});
