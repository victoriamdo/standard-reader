import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/reader/app-shell";
import { feedApi } from "../integrations/tanstack-query/api-feed.functions";

export const Route = createFileRoute("/_layout")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(feedApi.getSidebarQueryOptions());
  },
  component: LayoutRoute,
});

function LayoutRoute() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
