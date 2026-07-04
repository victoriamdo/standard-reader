import type { ActorIdentifier } from "@atcute/lexicons";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  atprotoOAuth,
  atprotoReviewOAuth,
  revokeAtprotoSession,
} from "#/integrations/auth/atproto";
import type { AuthScopeIntent } from "#/integrations/auth/scope";
import {
  ATSTORE_REVIEW_SCOPE,
  USERINPUT_BASIC_SCOPE,
  basicScope,
  collectionsScope,
  formatOAuthScope,
  hasCollectionsScope,
  hasUserinputFeedbackScope,
  resolveAuthScopeForUser,
} from "#/integrations/auth/scope";
import { sanitizeAuthRedirectTarget } from "#/utils/auth-redirect";
import { getSavedHandles } from "#/utils/saved-handles";

const authorizeInputSchema = z.object({
  handle: z.string().min(1, "Handle is required"),
  redirect: z.string().optional(),
  intent: z.enum(["subscribe", "collections"]).optional(),
  /** DID of the selected actor (from the handle autocomplete). When present
   * and the user has signed in before, the upgrade flag is read from their
   * `user` row so an existing collections author gets the collections scope
   * tier automatically. */
  did: z.string().optional(),
});

/**
 * Resolve whether a returning reader should be requested the collections
 * authoring scope tier on re-login. Two signals are consulted:
 *
 * 1. `user.collectionsAuthoringEnabled` — the opt-in flag, set when the reader
 *    went through the upgrade flow. Persists the upgrade so subsequent logins
 *    request the collections tier automatically.
 * 2. `account.scope` (granted scope, snapshotted on the last OAuth callback) —
 *    if the reader has *already granted* the collections tier on their PDS,
 *    we request it again on re-login so the grant is preserved rather than
 *    silently downgraded to basic.
 *
 * The reader is identified by `did` when known (threaded from the handle
 * autocomplete result). When `did` is absent — e.g. the saved-handles flow on
 * `/login`, which only stores `handle` — we resolve the DID from the indexed
 * `profiles.handle` column first. Best-effort: returns `false` when the reader
 * can't be identified (first sign-in, handle not yet indexed).
 */
async function shouldRequestCollectionsScope(args: {
  did?: string | undefined;
  handle: string;
}): Promise<boolean> {
  const [{ db }, schema] = await Promise.all([
    import("#/db/index.server"),
    import("#/db/schema"),
  ]);

  // Resolve the DID: prefer the explicit one, fall back to a profiles lookup
  // by handle (indexed). Normalise the handle the same way `authorize` does.
  let did = args.did;
  if (!did) {
    const normalizedHandle = args.handle.replace(/^@/, "").trim();
    const profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.handle, normalizedHandle),
      columns: { did: true },
    });
    did = profile?.did;
  }
  if (!did) return false;

  const row = await db.query.user.findFirst({
    where: eq(schema.user.did, did),
    columns: { collectionsAuthoringEnabled: true },
    with: {
      accounts: {
        columns: { scope: true, providerId: true },
        where: eq(schema.account.providerId, "atproto"),
      },
    },
  });
  if (!row) return false;
  if (row.collectionsAuthoringEnabled === true) return true;
  const atprotoAccount = row.accounts.find((a) => a.providerId === "atproto");
  return hasCollectionsScope(atprotoAccount?.scope ?? null);
}

/**
 * Mirror of {@link shouldRequestCollectionsScope} for the userinput.app feedback
 * scope tier. Returns `true` when the reader has either opted in
 * (`user.userinputFeedbackEnabled`) or already granted the scope on their PDS
 * (`account.scope` includes `repo?collection=app.userinput.discussion`). This
 * is what makes the feedback grant sticky: every sign-in silently re-requests
 * the scope once it's been granted once, so the user never sees the consent
 * screen twice.
 */
async function shouldRequestUserinputScope(args: {
  did?: string | undefined;
  handle: string;
}): Promise<boolean> {
  const [{ db }, schema] = await Promise.all([
    import("#/db/index.server"),
    import("#/db/schema"),
  ]);

  let did = args.did;
  if (!did) {
    const normalizedHandle = args.handle.replace(/^@/, "").trim();
    const profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.handle, normalizedHandle),
      columns: { did: true },
    });
    did = profile?.did;
  }
  if (!did) return false;

  const row = await db.query.user.findFirst({
    where: eq(schema.user.did, did),
    columns: { userinputFeedbackEnabled: true },
    with: {
      accounts: {
        columns: { scope: true, providerId: true },
        where: eq(schema.account.providerId, "atproto"),
      },
    },
  });
  if (!row) return false;
  if (row.userinputFeedbackEnabled === true) return true;
  const atprotoAccount = row.accounts.find((a) => a.providerId === "atproto");
  return hasUserinputFeedbackScope(atprotoAccount?.scope ?? null);
}

const authorize = createServerFn({ method: "GET" })
  .validator(authorizeInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const handle = data.handle.replace(/^@/, "").trim() as ActorIdentifier;
    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const scopeIntent: AuthScopeIntent =
      data.intent === "subscribe"
        ? "subscribe"
        : data.intent === "collections"
          ? "collections"
          : "basic";

    // Best-effort upgrade: if the user signed in before and either opted into
    // collections authoring (flag set) or has already granted the collections
    // tier on their PDS (`account.scope`), request the collections tier
    // automatically — even on a fresh sign-in from /login. Falls back to basic
    // when the reader can't be identified (first sign-in) or neither signal is
    // present. The DID is resolved from the handle when not threaded in.
    const [requestCollections, requestUserinput] = await Promise.all([
      shouldRequestCollectionsScope({ did: data.did, handle: data.handle }),
      shouldRequestUserinputScope({ did: data.did, handle: data.handle }),
    ]);
    const scope =
      scopeIntent === "collections" || requestCollections
        ? resolveAuthScopeForUser(
            {
              collectionsAuthoringEnabled: true,
              userinputFeedbackEnabled: requestUserinput,
            },
            scopeIntent,
            requestUserinput,
          )
        : resolveAuthScopeForUser(
            {
              collectionsAuthoringEnabled: false,
              userinputFeedbackEnabled: requestUserinput,
            },
            scopeIntent,
            requestUserinput,
          );

    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: handle,
      },
      scope,
      state: {
        redirect: redirectTarget,
        handle,
      },
    });

    return { authorizationUrl: url.toString() };
  });

const signupInputSchema = z.object({
  redirect: z.string().optional(),
});

const signup = createServerFn({ method: "GET" })
  .validator(signupInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoOAuth.authorize({
      prompt: "create",
      target: {
        type: "pds",
        serviceUrl: "https://selfhosted.social/",
      },
      state: {
        redirect: redirectTarget,
      },
    });

    return { authorizationUrl: url.toString() };
  });

const getSavedHandlesServer = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  const cookieHeader = request.headers.get("cookie");
  return getSavedHandles(cookieHeader);
});

const getSavedHandlesQueryOptions = queryOptions({
  queryKey: ["savedHandles"],
  queryFn: async () => {
    return await getSavedHandlesServer();
  },
});

const upgradeToCollectionsInputSchema = z.object({
  redirect: z.string().optional(),
});

/**
 * Progressive scope upgrade: opt the signed-in reader into collections
 * authoring. Sets the `collectionsAuthoringEnabled` flag (so future logins
 * silently include the expanded scope), revokes the current OAuth session,
 * and initiates a fresh authorize flow with the collections scope tier. The
 * client navigates to the returned URL; the callback returns to `redirect`.
 *
 * Per atproto.com/guides/oauth-patterns: BFF scope upgrades revoke + re-auth
 * because `prompt: consent` re-consent isn't reliable across PDS providers.
 * The flag persists the upgrade so subsequent authorize requests automatically
 * request the collections tier.
 */
const upgradeToCollections = createServerFn({ method: "POST" })
  .validator(upgradeToCollectionsInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const [{ db }, schema, { getReaderContextForRequest }] = await Promise.all([
      import("#/db/index.server"),
      import("#/db/schema"),
      import("#/middleware/auth-session.server"),
    ]);

    const reader = await getReaderContextForRequest(request);
    if (!reader) {
      throw new Error("Unauthorized");
    }

    // 1. Persist the upgrade flag — future authorize flows read this.
    await db
      .update(schema.user)
      .set({ collectionsAuthoringEnabled: true })
      .where(eq(schema.user.id, reader.userId));

    // 2. Revoke the current OAuth session so the next authorize grants the
    // expanded scopes. App session row cleanup happens on the callback that
    // establishes the new session.
    try {
      await revokeAtprotoSession(
        reader.did as Parameters<typeof revokeAtprotoSession>[0],
      );
    } catch (error) {
      console.warn("Failed to revoke Atproto session during upgrade:", error);
    }

    // 3. Kick off a fresh authorize with the collections scope tier. The
    // handle isn't known here (the reader is already signed in), so target
    // the account by DID.
    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: reader.did as ActorIdentifier,
      },
      scope: resolveAuthScopeForUser(
        { collectionsAuthoringEnabled: true },
        "collections",
      ),
      state: {
        redirect: redirectTarget,
      },
    });

    return { authorizationUrl: url.toString() };
  });

const upgradeToAtstoreReview = createServerFn({ method: "POST" })
  .validator(upgradeToCollectionsInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const [{ db }, schema, { getReaderContextForRequest }] = await Promise.all([
      import("#/db/index.server"),
      import("#/db/schema"),
      import("#/middleware/auth-session.server"),
    ]);

    const reader = await getReaderContextForRequest(request);
    if (!reader) {
      throw new Error("Unauthorized");
    }

    const row = await db.query.user.findFirst({
      where: eq(schema.user.id, reader.userId),
      columns: { collectionsAuthoringEnabled: true },
      with: {
        accounts: {
          columns: { scope: true, providerId: true },
          where: eq(schema.account.providerId, "atproto"),
        },
      },
    });
    const atprotoAccount = row?.accounts.find(
      (a) => a.providerId === "atproto",
    );
    const requestCollections =
      row?.collectionsAuthoringEnabled === true ||
      hasCollectionsScope(atprotoAccount?.scope ?? null);
    const baseScope = requestCollections ? collectionsScope : basicScope;

    try {
      await revokeAtprotoSession(
        reader.did as Parameters<typeof revokeAtprotoSession>[0],
      );
    } catch (error) {
      console.warn(
        "Failed to revoke Atproto session during ATStore review upgrade:",
        error,
      );
    }

    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoReviewOAuth.authorize({
      target: {
        type: "account",
        identifier: reader.did as ActorIdentifier,
      },
      scope: formatOAuthScope([
        ...new Set([...baseScope, ATSTORE_REVIEW_SCOPE]),
      ]),
      state: {
        redirect: redirectTarget,
      },
    });

    return { authorizationUrl: url.toString() };
  });

/**
 * Progressive scope upgrade: opt the signed-in reader into submitting
 * userinput.app feedback. Sets the `userinputFeedbackEnabled` flag (so future
 * logins silently include the expanded scope — see `shouldRequestUserinputScope`),
 * revokes the current OAuth session, and initiates a fresh authorize flow on
 * the *default* client (no separate OAuth client flavor) with the
 * `USERINPUT_BASIC_SCOPE` addendum. The client navigates to the returned
 * URL; the callback returns to `redirect`.
 *
 * Same revoke + re-auth shape as `upgradeToCollections` per
 * atproto.com/guides/oauth-patterns (BFF scope upgrades revoke + re-auth
 * because `prompt: consent` re-consent isn't reliable across PDS providers).
 * The user only sees the consent screen once: on every subsequent sign-in the
 * `authorize` fn silently re-appends the userinput scope via
 * `shouldRequestUserinputScope`.
 */
const upgradeToUserinputFeedback = createServerFn({ method: "POST" })
  .validator(upgradeToCollectionsInputSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    const [{ db }, schema, { getReaderContextForRequest }] = await Promise.all([
      import("#/db/index.server"),
      import("#/db/schema"),
      import("#/middleware/auth-session.server"),
    ]);

    const reader = await getReaderContextForRequest(request);
    if (!reader) {
      throw new Error("Unauthorized");
    }

    // 1. Persist the opt-in flag — future authorize flows read this and
    //    silently re-request the userinput scope on every login.
    await db
      .update(schema.user)
      .set({ userinputFeedbackEnabled: true })
      .where(eq(schema.user.id, reader.userId));

    // 2. Revoke the current OAuth session so the next authorize grants the
    //    expanded scope. App session row cleanup happens on the callback that
    //    establishes the new session.
    try {
      await revokeAtprotoSession(
        reader.did as Parameters<typeof revokeAtprotoSession>[0],
      );
    } catch (error) {
      console.warn(
        "Failed to revoke Atproto session during userinput feedback upgrade:",
        error,
      );
    }

    // 3. Kick off a fresh authorize on the DEFAULT client with the userinput
    //    scope addendum. baseScope is the user's existing tier (collections if
    //    opted in, otherwise basic) so we don't accidentally downgrade them.
    const row = await db.query.user.findFirst({
      where: eq(schema.user.id, reader.userId),
      columns: { collectionsAuthoringEnabled: true },
      with: {
        accounts: {
          columns: { scope: true, providerId: true },
          where: eq(schema.account.providerId, "atproto"),
        },
      },
    });
    const atprotoAccount = row?.accounts.find(
      (a) => a.providerId === "atproto",
    );
    const requestCollections =
      row?.collectionsAuthoringEnabled === true ||
      hasCollectionsScope(atprotoAccount?.scope ?? null);
    const baseScope = requestCollections ? collectionsScope : basicScope;

    const redirectTarget = sanitizeAuthRedirectTarget(
      data.redirect,
      request.url,
    );

    const { url } = await atprotoOAuth.authorize({
      target: {
        type: "account",
        identifier: reader.did as ActorIdentifier,
      },
      scope: formatOAuthScope([
        ...new Set([...baseScope, USERINPUT_BASIC_SCOPE]),
      ]),
      state: {
        redirect: redirectTarget,
      },
    });

    return { authorizationUrl: url.toString() };
  });

export const auth = {
  authorize,
  signup,
  upgradeToCollections,
  upgradeToAtstoreReview,
  upgradeToUserinputFeedback,
  getSavedHandles: getSavedHandlesServer,
  getSavedHandlesQueryOptions,
};
