import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { reactNodePlainText } from "./react-node-text";

describe("reactNodePlainText", () => {
  it("returns the string for plain string nodes", () => {
    expect(reactNodePlainText("hello")).toBe("hello");
  });

  it("returns the empty string for nullish/boolean nodes", () => {
    const maybeMissing: string | undefined = undefined;
    expect(reactNodePlainText(null)).toBe("");
    expect(reactNodePlainText(maybeMissing)).toBe("");
    expect(reactNodePlainText(true)).toBe("");
    expect(reactNodePlainText(false)).toBe("");
  });

  it("stringifies numbers", () => {
    expect(reactNodePlainText(42)).toBe("42");
  });

  it("concatenates arrays of plain text", () => {
    expect(reactNodePlainText(["foo", " ", "bar"])).toBe("foo bar");
  });

  it("returns null for a React element", () => {
    const link = createElement("a", { href: "https://example.com" }, "link");
    // Stringifying a React element yields "[object Object]" — the helper must
    // signal that the node carries inline markup so callers skip the drop cap.
    expect(reactNodePlainText(link)).toBeNull();
    expect(String(link)).toBe("[object Object]");
  });

  it("returns null for an array containing a React element", () => {
    const link = createElement("a", { href: "https://example.com" }, "link");
    expect(reactNodePlainText(["before ", link, " after"])).toBeNull();
  });

  // Regression: the Standard Reader drop-cap handler used to call
  // `String(children)` on the first paragraph. A markdown body that opens with
  // a link (e.g. "[label](https://...) text") is parsed by react-markdown into
  // a paragraph whose children include an `<a>` element, so the drop cap
  // rendered "[object Object]" as the first block.
  it("guards the drop-cap regression — a markdown-link paragraph is not plain text", () => {
    const markdownLinkParagraph = [
      createElement(
        "a",
        { href: "https://herrmontag.de/atproto" },
        "herrmontag.de: ATProto",
      ),
      " — gefolgt von weiterem Text.",
    ];
    expect(reactNodePlainText(markdownLinkParagraph)).toBeNull();
  });
});
