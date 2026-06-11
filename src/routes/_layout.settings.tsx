import { createFileRoute, redirect } from "@tanstack/react-router";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { getPublicUrlClient } from "#/lib/public-url";
import { pageSocialMeta } from "#/lib/site-metadata";
import { buildAuthRedirectPath } from "#/utils/auth-redirect";

import { UserSettingsView } from "../components/user-settings-view";

export const Route = createFileRoute("/_layout/settings")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: buildAuthRedirectPath("/settings") },
      });
    }
  },
  head: () => ({
    meta: pageSocialMeta("settings", getPublicUrlClient()),
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return <UserSettingsView />;
}
