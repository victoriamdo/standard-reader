/**
 * Runtime configuration, read once from the environment.
 *
 * The whole service is configured through these few values — see `.env.example`.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  /** DID this labeler publishes labels under (the `src` of every label). */
  labelerDid: optional("LABELER_DID", "did:web:claudeslop.standard-reader.app"),
  /** Public origin, used in the DID document's serviceEndpoint. */
  publicUrl: optional("PUBLIC_URL", "http://localhost:4100").replace(/\/$/, ""),
  /** Hex-encoded secp256k1 private key. Empty in read-only/serve-only mode. */
  signingKeyHex: process.env.LABELER_SIGNING_KEY ?? "",
  /** Jetstream firehose to consume document creates/updates from. */
  jetstreamUrl: optional(
    "JETSTREAM_URL",
    "wss://jetstream2.us-east.bsky.network/subscribe",
  ),
  /** SQLite database path (label store + cursors). */
  sqlitePath: optional("SQLITE_PATH", "./claudeslop.db"),
  /** HTTP/WS port. */
  port: Number(optional("PORT", "4100")),
  /** Base URL of the detector inference sidecar (see `detector/`). */
  detectorUrl: optional("DETECTOR_URL", "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  ),

  /** The single label value this labeler emits. */
  labelValue: "ai-writing",
  /**
   * Score at/above which a document is labeled. The detector returns a
   * calibrated 0..1 machine-generated probability. Empirically on this corpus
   * clearly-human prose scores under ~0.25 and confident AI slop scores 0.95+,
   * with a band of genuinely-ambiguous text in between — so we default to a
   * conservative 0.85 to keep false positives low (raise for fewer labels).
   */
  aiThreshold: Number(optional("AI_THRESHOLD", "0.85")),
  /** Bump to invalidate prior scans and re-evaluate every document. */
  detectorVersion: Number(optional("DETECTOR_VERSION", "3")),
  /** Collection on the firehose we care about. */
  documentCollection: "site.standard.document",
} as const;

export { required };
