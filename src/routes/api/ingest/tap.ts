import { createFileRoute } from "@tanstack/react-router";

import type { TapEvent } from "../../../server/atproto/types.ts";

import { verifyIngestAuth } from "../../../server/ingest/auth.ts";
import { processTapEvents } from "../../../server/ingest/consumer.ts";

/**
 * Ingestion webhook for the `tap` service. Configure tap with
 * `TAP_WEBHOOK_URL=<PUBLIC_URL>/api/ingest/tap`; tap POSTs each verified record/
 * identity event here (HTTP Basic auth with `admin:<TAP_ADMIN_PASSWORD>`) and
 * treats a 200 as the ack.
 *
 * We always respond 200 once the batch is durably handled (failures are
 * dead-lettered, not surfaced as 5xx) so a single poison event never wedges
 * tap's per-repo ordering.
 */
function normalizeEvents(body: unknown): Array<TapEvent> {
  if (Array.isArray(body)) {
    return body as Array<TapEvent>;
  }
  if (body && typeof body === "object") {
    const maybe = body as { events?: Array<TapEvent>; type?: string };
    if (Array.isArray(maybe.events)) {
      return maybe.events;
    }
    if (maybe.type === "record" || maybe.type === "identity") {
      return [body as TapEvent];
    }
  }
  return [];
}

export const Route = createFileRoute("/api/ingest/tap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyIngestAuth(request)) {
          return new Response("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="ingest"' },
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const events = normalizeEvents(body);
        if (events.length === 0) {
          return Response.json({ ok: 0, failed: 0, skipped: true });
        }

        const result = await processTapEvents(events);
        if (result.failed > 0) {
          console.warn(
            `[ingest] processed ${result.ok}, dead-lettered ${result.failed}`,
          );
        }
        return Response.json(result);
      },
    },
  },
});
