import { describe, expect, it } from "vitest";

import { hasEditorial, parseCollectionManifest } from "./manifest.ts";

const ITEM = "at://did:plc:abc/site.standard.document/3kfoo";
const ITEM_2 = "at://did:plc:abc/site.standard.document/3kbar";

describe("parseCollectionManifest", () => {
  it("returns null for non-collection values", () => {
    expect(parseCollectionManifest()).toBeNull();
    expect(parseCollectionManifest(null)).toBeNull();
    expect(parseCollectionManifest("nope")).toBeNull();
    expect(parseCollectionManifest({})).toBeNull();
    // items present but empty / all malformed → not a collection.
    expect(parseCollectionManifest({ items: [] })).toBeNull();
    expect(parseCollectionManifest({ items: [{ note: "no doc" }] })).toBeNull();
  });

  it("parses ordered items and drops malformed entries", () => {
    const manifest = parseCollectionManifest({
      items: [
        { document: ITEM, note: "why I picked this" },
        { document: "  ", note: "blank doc dropped" },
        { document: ITEM_2 },
      ],
    });
    expect(manifest).toEqual({
      items: [
        { document: ITEM, note: "why I picked this" },
        { document: ITEM_2 },
      ],
    });
  });

  it("keeps an editorial only when it has a title or body", () => {
    expect(
      parseCollectionManifest({
        editorial: { title: "Issue One", body: "Welcome." },
        items: [{ document: ITEM }],
      })?.editorial,
    ).toEqual({ title: "Issue One", body: "Welcome." });

    // Whitespace-only editorial collapses away.
    const noEditorial = parseCollectionManifest({
      editorial: { title: "   ", body: "" },
      items: [{ document: ITEM }],
    });
    expect(noEditorial?.editorial).toBeUndefined();
    expect(noEditorial && hasEditorial(noEditorial)).toBe(false);
  });
});
