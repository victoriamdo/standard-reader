import type { Span } from "./log.ts";

/** Attach signed-in reader identity to a Honeycomb/log span when available.
 *
 * Uses the DB-only DID lookup (`getReaderDidForRequest`) instead of the full
 * `getAtprotoSessionForRequest`, which restores the PDS client and incurs a
 * network round trip. Span labeling only needs the DID; any handler that
 * actually needs the PDS client restores it explicitly. */
export async function attachReaderSpanContext(
  span: Span,
  request: Request,
): Promise<string | null> {
  const { getReaderDidForRequest } =
    await import("#/middleware/auth-session.server");
  const did = (await getReaderDidForRequest(request)) ?? null;
  span.set("signedIn", did != null);
  if (did) {
    span.set("did", did);
  }
  return did;
}
