/**
 * Runtime configuration, read once from the environment. See `.env.example`.
 */

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  /** DID this labeler publishes labels under (the `src` of every label). */
  labelerDid: optional("LABELER_DID", "did:web:botlabeler.standard-reader.app"),
  /** Public origin, used in the DID document's serviceEndpoint. */
  publicUrl: optional("PUBLIC_URL", "http://localhost:4101").replace(/\/$/, ""),
  /** Hex-encoded secp256k1 private key. */
  signingKeyHex: process.env.LABELER_SIGNING_KEY ?? "",
  /** Jetstream firehose to consume document creates/updates from. */
  jetstreamUrl: optional(
    "JETSTREAM_URL",
    "wss://jetstream2.us-east.bsky.network/subscribe",
  ),
  /** SQLite database path (label store + cursors). */
  sqlitePath: optional("SQLITE_PATH", "./botlabeler.db"),
  /** HTTP/WS port. */
  port: Number(optional("PORT", "4101")),

  /** The single label value this labeler emits. */
  labelValue: "bot",
  /** Bump to invalidate prior scans and re-evaluate every document. */
  detectorVersion: Number(optional("DETECTOR_VERSION", "1")),
  /** Collection on the firehose we care about. */
  documentCollection: "site.standard.document",
} as const;
