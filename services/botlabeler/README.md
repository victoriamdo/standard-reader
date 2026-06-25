# botlabeler — a "bot accounts" AT Protocol labeler

A standalone labeler that flags posts from accounts which have **self-declared as
bots**. It's a sibling of [`../claudeslop`](../claudeslop) and shares the same
shape (Jetstream → detect → sign → SQLite → serve `queryLabels` /
`subscribeLabels`); only the detector differs.

## What counts as a bot

There is no boolean flag for "automated account" on `app.bsky.actor.profile`. The
on-network way an account declares itself a bot is a **self-label**: the profile
record's `labels` field is a `com.atproto.label.defs#selfLabels` object whose
`values` include `{ "val": "bot" }`. botlabeler reads each author's profile record
straight from their PDS, caches the verdict, and labels their `site.standard.document`
posts `bot` when present (`src/bot.ts`).

## Endpoints

Identical surface to claudeslop:

| Endpoint | What it does |
| --- | --- |
| `GET /.well-known/did.json` | The did:web document (labeler service + signing key). |
| `GET /xrpc/com.atproto.label.queryLabels` | Point-in-time label lookup. |
| `GET /xrpc/com.atproto.label.subscribeLabels` | WebSocket firehose of labels. |
| `GET /xrpc/app.standard-reader.labeler.getServices` | The labeler descriptor. |
| `GET /health` | Liveness + label count. |

## Running it

```bash
pnpm install
pnpm gen-key                 # prints LABELER_SIGNING_KEY=… (save it)
cp .env.example .env         # fill in LABELER_SIGNING_KEY (+ DID/URL for prod)
pnpm dev                     # detector + server, http://localhost:4101
pnpm backfill                # label the last 100 posts' bot authors now
pnpm test                    # bot-detection + signing unit tests
```

Local development against Standard Reader: use a loopback DID
(`LABELER_DID=did:web:localhost%3A4101`, `PUBLIC_URL=http://localhost:4101`) and
add that DID to the app's `KNOWN_LABELERS` so it appears at `/labelers`.

## Deploying

One always-on process (`pnpm start`). Persist the SQLite file (volume at
`SQLITE_PATH`) and make `/.well-known/did.json` reachable at the DID's host.
