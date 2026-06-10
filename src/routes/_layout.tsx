import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/reader/app-shell";
import { feedApi } from "../integrations/tanstack-query/api-feed.functions";
import { listApi } from "../integrations/tanstack-query/api-lists.functions";

export const Route = createFileRoute("/_layout")({
  loader: async ({ context }) => {
    // Sidebar data: follows + own lists + saved lists (all no-ops signed out).
    await Promise.all([
      context.queryClient.ensureQueryData(feedApi.getSidebarQueryOptions()),
      context.queryClient.ensureQueryData(listApi.getListsQueryOptions()),
      context.queryClient.ensureQueryData(listApi.getSavedListsQueryOptions()),
    ]);
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
