import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { AppShell } from "../components/reader/app-shell";
import { ReaderContent } from "../components/reader/primitives";
import { Flex } from "../design-system/flex";
import { Skeleton } from "../design-system/skeleton";
import { spacing } from "../design-system/theme/spacing.stylex";
import { feedApi } from "../integrations/tanstack-query/api-feed.functions";
import { listApi } from "../integrations/tanstack-query/api-lists.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";

export const Route = createFileRoute("/_layout")({
  loader: async ({ context }) => {
    const session = context.queryClient.getQueryData(
      user.getSessionQueryOptions.queryKey,
    );
    const signedIn = Boolean(session?.user);

    if (signedIn) {
      await Promise.all([
        context.queryClient.ensureQueryData(feedApi.getSidebarQueryOptions()),
        context.queryClient.ensureQueryData(listApi.getListsQueryOptions()),
        context.queryClient.ensureQueryData(
          listApi.getSavedListsQueryOptions(),
        ),
      ]);
      return;
    }

    void context.queryClient.prefetchQuery(feedApi.getSidebarQueryOptions());
  },
  component: LayoutRoute,
});

function RouteContentFallback() {
  return (
    <ReaderContent>
      <div aria-busy="true" aria-label="Loading page">
        <Flex direction="column" gap="3xl">
          <Skeleton variant="rectangle" height={spacing["4"]} width="32%" />
          <Skeleton variant="rectangle" height={spacing["10"]} width="48%" />
          <Skeleton variant="rectangle" height={spacing["5"]} width="72%" />
        </Flex>
      </div>
    </ReaderContent>
  );
}

function LayoutRoute() {
  return (
    <AppShell>
      <Suspense fallback={<RouteContentFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
