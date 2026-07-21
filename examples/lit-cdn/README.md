# Lit + CDN example

A two-file Standard Reader blog reader with **no build step** — every dependency
loads from [jsDelivr](https://www.jsdelivr.com/)'s ESM CDN via an import map.

- **`index.html`** — the blog index. Uses the typed lexicon client
  ([`@standard-reader/lexicons`](https://www.npmjs.com/package/@standard-reader/lexicons)
  + [`@atproto/lex-client`](https://www.npmjs.com/package/@atproto/lex-client)) to
  call `getAuthor` and `getPublicationDocuments`, and renders the author header +
  each publication's posts as a Lit element.
- **`post.html`** — the post viewer. Calls `getDocument` (one call returns
  metadata **and** the renderable body) and renders it with the
  [`@standard-reader/renderer-lit`](https://www.npmjs.com/package/@standard-reader/renderer-lit)
  `<standard-document>` web component. Embedded Bluesky posts are rendered by
  plugging the [`bluesky-post-embed`](https://www.npmjs.com/package/bluesky-post-embed)
  `<bluesky-post>` element into the renderer's `blueskyEmbed` component slot.

## Run it

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000
```

Any static file server works — there's nothing to compile.

## Any profile

Pass `?handle=` to view any author — a handle or a raw DID:

```
index.html?handle=cameron.stream
index.html?handle=did:plc:gfrmhdmjvxn2sjedzboeudef
```

With no query string it defaults to a sample profile. There's also a small
switcher input at the top of the page. Handles are resolved to a DID with
`com.atproto.identity.resolveHandle` (Bluesky's public, CORS-open API); DIDs are
used as-is. `getAuthor` itself takes a DID.

## Note: no relaxed validation

The `client.call(...)`s use the typed client's **default strict validation** —
no `validateResponse` / `strictResponseProcessing` escape hatches. Two upstream
fixes made that possible; both were needed because `@standard-reader/lexicons@0.1.0`
was stricter than the live API:

- **Nullable fields** — `@atproto/lex@0.3.0` dropped the lexicons'
  `nullable: true` markers, so the schemas rejected the explicit `null`s the API
  returns (e.g. `searchNameHtml`). Fixed in **`@standard-reader/lexicons@0.1.1`**,
  whose codegen now emits `l.nullable(...)` for those fields (see the package's
  `scripts/patch-nullable.mjs`). This example imports `@0.1.1`.

- **Blob refs** — document `content` carried image blob CID links in the IPLD
  dag-json form `{"/": cid}`, which a strict Lex parser rejects ("Invalid blob
  object"). The AppView now normalizes them to the lex-JSON form `{"$link": cid}`
  on output, so `getDocument` conforms to the wire format every atproto client
  expects.
