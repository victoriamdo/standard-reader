/** Shared site copy for `<head>` and social previews. */
export const SITE_NAME = "Standard Reader";

/** Primary meta description — keep under ~160 characters for search snippets. */
export const SITE_DESCRIPTION =
  "Read and discover standard.site publications on the Atmosphere. Follow the writers you love and find new long-form voices across the network.";

/** Shorter line for OG cards and manifest text. */
export const SITE_TAGLINE =
  "A warm reader for standard.site publications on the Atmosphere.";

export const SITE_OG_IMAGE_PATH = "/api/og/site";

export function siteOgImageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}${SITE_OG_IMAGE_PATH}`;
}

type HeadMetaEntry =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/** Default Open Graph + Twitter tags for site-level pages. */
export function siteSocialMeta(
  options: {
    title?: string;
    description?: string;
    url?: string;
    ogImage?: string;
    ogType?: "website" | "article";
  } = {},
): Array<HeadMetaEntry> {
  const title = options.title ?? SITE_NAME;
  const description = options.description ?? SITE_DESCRIPTION;
  const ogType = options.ogType ?? "website";

  const meta: Array<HeadMetaEntry> = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
  ];

  if (options.url) {
    meta.push({ property: "og:url", content: options.url });
  }

  if (options.ogImage) {
    meta.push(
      { property: "og:image", content: options.ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: options.ogImage },
    );
  } else {
    meta.push({ name: "twitter:card", content: "summary" });
  }

  meta.push(
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  );

  return meta;
}
