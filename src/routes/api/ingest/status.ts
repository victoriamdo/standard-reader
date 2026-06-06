import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { db } from "../../../db/index.ts";
import { ingestState } from "../../../db/schema.ts";
import { verifyIngestAuth } from "../../../server/ingest/auth.ts";

/**
 * Ingestion observability: consumer checkpoint + read-model row counts +
 * dead-letter backlog. Auth-guarded since it exposes operational internals.
 */
export const Route = createFileRoute("/api/ingest/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifyIngestAuth(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const [state] = await db.select().from(ingestState);
        const counts = await db.execute(sql`
          SELECT
            (SELECT count(*) FROM publications WHERE deleted = false) AS publications,
            (SELECT count(*) FROM documents WHERE deleted = false) AS documents,
            (SELECT count(*) FROM subscriptions WHERE deleted = false) AS subscriptions,
            (SELECT count(*) FROM recommends WHERE deleted = false) AS recommends,
            (SELECT count(*) FROM profiles) AS profiles,
            (SELECT count(*) FROM tracked_repos) AS tracked_repos,
            (SELECT count(*) FROM ingest_dead_letter) AS dead_letter
        `);

        return Response.json({
          stream: state ?? null,
          counts: counts.rows[0] ?? null,
        });
      },
    },
  },
});
