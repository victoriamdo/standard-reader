"use client";

import {
  googleFontsPreviewStylesheetUrl,
  googleFontsStylesheetUrl,
} from "#/lib/google-fonts";
import { useEffect } from "react";

function linkIdForFamily(family: string, variant: "full" | "preview"): string {
  const slug = family.trim().toLowerCase().replace(/\s+/g, "-");
  return variant === "preview"
    ? `google-font-preview-${slug}`
    : `google-font-${slug}`;
}

export function ReadingCustomFontLoader({
  family,
  variant = "full",
}: {
  family: string | null | undefined;
  variant?: "full" | "preview";
}) {
  useEffect(() => {
    const normalized = family?.trim();
    if (!normalized) return;

    const id = linkIdForFamily(normalized, variant);
    const existing = document.getElementById(id);
    if (existing instanceof HTMLLinkElement) {
      return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      variant === "preview"
        ? googleFontsPreviewStylesheetUrl(normalized)
        : googleFontsStylesheetUrl(normalized);
    document.head.append(link);
  }, [family, variant]);

  return null;
}
