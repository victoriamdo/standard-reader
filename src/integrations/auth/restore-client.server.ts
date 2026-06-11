import type { Did } from "@atcute/lexicons";

import { Client } from "@atcute/client";
import { restoreAppPasswordClient } from "#/integrations/auth/app-password-session.server";
import { restoreAtprotoSession } from "#/integrations/auth/atproto";

/** OAuth session first; app-password fallback when perf env is enabled. */
export async function restoreAuthenticatedClient(
  did: Did,
): Promise<Client | null> {
  const oauthSession = await restoreAtprotoSession(did);
  if (oauthSession) {
    return new Client({ handler: oauthSession });
  }

  const appPasswordClient = await restoreAppPasswordClient(did);
  if (!appPasswordClient) {
    return null;
  }

  return new Client({ handler: appPasswordClient });
}
