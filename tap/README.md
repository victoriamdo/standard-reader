# `tap` — ingestion service for the Standard Reader read-model

[`tap`](https://github.com/bluesky-social/indigo/blob/main/cmd/tap/README.md)
is a single-tenant AT Protocol sync service (from `bluesky-social/indigo`). It
subscribes to a relay firehose, verifies repo structure + identity signatures,
**backfills** full repo history from each PDS, and emits filtered JSON events.

We run it as the ingestion tier for Standard Reader: tap delivers
`site.standard.*` records (+ `app.bsky.actor.profile`) to our webhook
(`/api/ingest/tap`), which upserts them into the Neon read-model. The canonical
records always live in each author's repo — Neon is only a cache.

```
relay firehose ──► tap (verify + backfill + filter) ──webhook──► /api/ingest/tap ──► Neon
```

## Prerequisites

- Docker (with Compose), or a locally built `tap` binary.
- The Standard Reader app running and reachable from the container (default
  webhook target is `http://host.docker.internal:3000/api/ingest/tap`).
- A shared secret in **both** places:
  - app `.env`: `INGEST_WEBHOOK_SECRET=<secret>` (and optionally `TAP_API_URL=http://127.0.0.1:2480` to enable dynamic repo tracking),
  - `tap/.env`: `TAP_ADMIN_PASSWORD=<same secret>`.

## Quick start (local dev)

```bash
cd tap
cp .env.example .env
# edit .env: set TAP_ADMIN_PASSWORD (must match the app's INGEST_WEBHOOK_SECRET)

docker compose up -d
docker compose logs -f tap        # watch it connect + backfill

# Seed some repos to index (defaults to the standard.site publisher repo):
./seed-repos.sh did:plc:xxxx did:plc:yyyy

# Observe:
curl -u admin:$TAP_ADMIN_PASSWORD http://127.0.0.1:2480/stats/repo-count
curl -u admin:$TAP_ADMIN_PASSWORD http://127.0.0.1:2480/stats/record-count

# Check the read-model side (app must be running):
curl -u admin:$INGEST_WEBHOOK_SECRET http://localhost:3000/api/ingest/status
```

As repos backfill, events stream to the webhook and rows appear in Neon. After
the initial catch-up, recompute the derived aggregates (stats + co-subscription
graph used for trending/recommendations):

```bash
curl -u admin:$INGEST_WEBHOOK_SECRET -X POST http://localhost:3000/api/ingest/recompute
```

Schedule that on a cron (e.g. every few minutes) in production.

## Network boundary: what gets indexed

`tap` first decides **which repos** to track, then filters **which records** to
deliver. Our defaults (see `docker-compose.yml`):

- `TAP_SIGNAL_COLLECTION=site.standard.publication` — track every repo that has
  at least one publication record (i.e. all standard.site **publishers**).
- `TAP_COLLECTION_FILTERS=site.standard.*,app.bsky.actor.profile` — of those
  repos, deliver only the standard.site collections we model + Bluesky profiles.

This indexes **all publications, their documents, contributor/owner profiles,
and any subscription/recommend records that live in publisher repos.**

The app also expands tracking dynamically: when the consumer ingests a record
referencing another repo (a document contributor, a subscription's target
publication, a recommend's document author), it calls tap's `/repos/add` for
that DID (requires `TAP_API_URL` set in the app env). So the index grows along
the graph from the publication seed.

### Capturing the full subscription/recommend graph

Subscriptions/recommends authored by **reader-only** repos (DIDs that own no
publication) aren't reachable from the publication seed alone. To index the
whole graph, pick one:

- **Full network** (heaviest, days/weeks to backfill, high bandwidth):
  set `TAP_FULL_NETWORK=true` (remove `TAP_SIGNAL_COLLECTION`).
- **Second signal instance**: run another tap with
  `TAP_SIGNAL_COLLECTION=site.standard.graph.subscription` (and the same
  filters/webhook) to also seed from subscriber repos.

> ⚠️ Bandwidth note: tap consumes the **entire** firehose and filters locally,
> so egress/ingress is non-trivial. Budget accordingly (or use a lighter
> Jetstream-based consumer if you don't need backfill/verification).

## Delivery semantics

- tap delivers **at least once** and acks a webhook event on HTTP `200`.
- Our webhook applies events as **idempotent upserts/deletes**, so redelivery is
  safe. Failures are written to `ingest_dead_letter` and still 200'd, so one bad
  event never wedges tap's per-repo ordering.
- tap owns the firehose cursor + per-repo backfill state (in its own
  SQLite/Postgres store). The app's `ingest_state` table is a high-water mark
  for observability only.

## Configuration reference

All tap env vars are documented upstream; the ones we set live in
`docker-compose.yml` and `.env.example`. Key ones:

| Var                             | Purpose                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `TAP_DATABASE_URL`              | tap's own store (SQLite volume by default; can be Postgres) |
| `TAP_RELAY_URL` / `TAP_PLC_URL` | upstream relay + PLC directory                              |
| `TAP_SIGNAL_COLLECTION`         | which repos to track (network boundary)                     |
| `TAP_COLLECTION_FILTERS`        | which collections to deliver                                |
| `TAP_WEBHOOK_URL`               | our ingestion endpoint                                      |
| `TAP_ADMIN_PASSWORD`            | Basic-auth secret (admin API **and** webhook)               |

## Production notes

- Keep the admin API (`:2480`) private; always set `TAP_ADMIN_PASSWORD`.
- Use a Postgres `TAP_DATABASE_URL` for higher throughput.
- Run the `recompute` cron after backfill stabilizes.
- Deploying on Railway/Fly/etc.: this compose file maps cleanly to a single
  long-running container with a persistent volume at `/data`.
