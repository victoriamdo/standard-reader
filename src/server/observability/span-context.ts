import type { Span } from "./log.ts";

/** Attach signed-in reader identity to a Honeycomb/log span when available. */
export async function attachReaderSpanContext(
  span: Span,
  request: Request,
): Promise<string | null> {
  const { getAtprotoSessionForRequest } =
    await import("#/middleware/auth-session.server");
  const session = await getAtprotoSessionForRequest(request);
  const did = session?.did ?? null;
  span.set("signedIn", did != null);
  if (did) {
    span.set("did", did);
  }
  return did;
}
