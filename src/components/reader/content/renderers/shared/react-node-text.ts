import type { ReactNode } from "react";

/**
 * Concatenate the plain-text content of a React node, or return `null` when
 * the node contains any React element.
 *
 * Why `null` instead of forcing text: the only caller is the markdown drop-cap
 * handler, which turns the paragraph's first character into a floated letter
 * and renders the rest as a plain string. If the paragraph contains inline
 * markup (a link, bold, code, …) that path would strip the formatting and
 * stringifying a React element yields `"[object Object]"`. Returning `null`
 * lets the caller skip the drop cap and render the original children with
 * formatting intact.
 */
export function reactNodePlainText(node: ReactNode): string | null {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    let text = "";
    for (const child of node) {
      const part = reactNodePlainText(child);
      if (part === null) return null;
      text += part;
    }
    return text;
  }
  // Any other object is a React element — stringifying would lose formatting.
  return null;
}
