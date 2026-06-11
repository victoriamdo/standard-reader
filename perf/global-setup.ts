import "dotenv/config";

import { bootstrapPerfAuth } from "./lib/bootstrap-session.ts";
import { hasPerfSignedInCredentials } from "./lib/auth.ts";

export default async function globalSetup(): Promise<void> {
  if (!hasPerfSignedInCredentials()) {
    return;
  }

  await bootstrapPerfAuth();
}
