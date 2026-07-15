/**
 * Public base URL for absolute links (OG tags, OAuth, share URLs).
 *
 * On a non-production Railway deployment (PR previews, staging) each deployment
 * gets its own `RAILWAY_PUBLIC_DOMAIN`, but inherits prod's `PUBLIC_URL` from
 * shared variables. The atproto OAuth `client_id`, `redirect_uri`, and
 * `jwks_uri` must point at THIS deployment (see `#/integrations/auth/atproto`)
 * so the PDS returns the reader to the preview after login instead of prod —
 * so previews resolve their base URL from `RAILWAY_PUBLIC_DOMAIN` instead.
 * Production runs in the environment named `production` (override with
 * `RAILWAY_PRODUCTION_ENVIRONMENT`) and keeps its explicit `PUBLIC_URL` custom
 * domain, ignoring the railway.app subdomain.
 */
export function getPublicUrl(): string {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const environmentName = process.env.RAILWAY_ENVIRONMENT_NAME;
  const productionEnvironment =
    process.env.RAILWAY_PRODUCTION_ENVIRONMENT || "production";
  if (
    railwayDomain &&
    environmentName &&
    environmentName !== productionEnvironment
  ) {
    return `https://${railwayDomain}`;
  }

  const url =
    process.env.PUBLIC_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.ATPROTO_BASE_URL;
  if (!url) {
    throw new Error(
      "PUBLIC_URL (or BETTER_AUTH_URL / ATPROTO_BASE_URL) environment variable is required",
    );
  }
  return url.replace("localhost", "127.0.0.1").replace(/\/$/, "");
}

/** Browser-safe public URL — falls back to the current origin in dev. */
export function getPublicUrlClient(): string {
  if (globalThis.window !== undefined) {
    return globalThis.window.location.origin;
  }
  return getPublicUrl();
}
