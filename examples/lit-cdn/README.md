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
  `<standard-document>` web component.

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

## Note: relaxed client checks

Each `client.call(...)` passes `{ validateResponse: false, strictResponseProcessing: false }`.
Inputs and outputs stay fully typed; only the client's two strict **runtime**
checks are relaxed, because `@standard-reader/lexicons@0.1.0` (generated with
`@atproto/lex@0.3.0`) is stricter than the live API's real responses:

- **`validateResponse: false`** — the generator drops the lexicons'
  `nullable: true` markers, so the schemas treat nullable fields as plain
  (non-null) strings. The API legitimately returns explicit `null` (e.g.
  `searchNameHtml` on non-search results), which otherwise fails with:

  ```
  Invalid response payload: Expected string value type (got null) at $.publications[0].searchNameHtml
  ```

- **`strictResponseProcessing: false`** — document `content` embeds AT Proto
  image **blob refs**, which the client's strict Lex processor rejects with:

  ```
  Unable to parse response payload: Invalid blob object
  ```

  Non-strict mode passes the blob refs through as-is — exactly what the renderer
  needs to build image URLs from the blob CID + author DID.

Relaxing these is the pragmatic fix for a demo. The real fix is in the package:
regenerate so nullable fields accept `null` (and blob shapes match), then
republish. Once that ships, drop these two arguments.
