import type { QueryClient } from "@tanstack/react-query";

import type { SidebarData } from "../../integrations/tanstack-query/api-feed.functions";
import type { FollowStatus } from "../../integrations/tanstack-query/api-reader.functions";
import type { PublicationCard } from "../../integrations/tanstack-query/api-shapes";

import { sortFollowingPublications } from "../../integrations/tanstack-query/api-shapes";
export interface FollowOptimisticContext {
  prevFollow: FollowStatus | undefined;
  prevSidebar: SidebarData | undefined;
}

/** Optimistically flip follow state in the React Query cache (sidebar + status). */
export function applyFollowOptimisticUpdate(
  queryClient: QueryClient,
  {
    publicationUri,
    pub,
    following,
  }: {
    publicationUri: string;
    pub?: PublicationCard;
    following: boolean;
  },
): FollowOptimisticContext {
  const followKey = ["reader", "followStatus", publicationUri] as const;
  const sidebarKey = ["feed", "sidebar"] as const;

  const prevFollow = queryClient.getQueryData<FollowStatus>(followKey);
  const prevSidebar = queryClient.getQueryData<SidebarData>(sidebarKey);

  queryClient.setQueryData<FollowStatus>(followKey, { isFollowing: following });

  if (prevSidebar) {
    const current = prevSidebar.following ?? [];
    const nextFollowing = following
      ? sortFollowingPublications([
          ...current.filter((item) => item.uri !== publicationUri),
          ...(pub ? [{ ...pub, unreadCount: 0 }] : []),
        ])
      : current.filter((item) => item.uri !== publicationUri);

    queryClient.setQueryData<SidebarData>(sidebarKey, {
      ...prevSidebar,
      following: nextFollowing,
    });
  }

  return { prevFollow, prevSidebar };
}

export function rollbackFollowOptimisticUpdate(
  queryClient: QueryClient,
  publicationUri: string,
  context: FollowOptimisticContext,
) {
  const followKey = ["reader", "followStatus", publicationUri] as const;
  const sidebarKey = ["feed", "sidebar"] as const;

  if (context.prevFollow) {
    queryClient.setQueryData(followKey, context.prevFollow);
  } else {
    queryClient.removeQueries({ queryKey: followKey });
  }

  if (context.prevSidebar) {
    queryClient.setQueryData(sidebarKey, context.prevSidebar);
  }
}

export function invalidateFollowQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["feed"] });
  void queryClient.invalidateQueries({ queryKey: ["discover"] });
}

export interface BulkFollowOptimisticContext {
  entries: Array<{
    publicationUri: string;
    prevFollow: FollowStatus | undefined;
  }>;
  prevSidebar: SidebarData | undefined;
}

/** Optimistically mark many publications as followed (e.g. tag "follow all"). */
export function applyBulkFollowOptimisticUpdate(
  queryClient: QueryClient,
  publications: Array<PublicationCard>,
): BulkFollowOptimisticContext {
  const sidebarKey = ["feed", "sidebar"] as const;
  const prevSidebar = queryClient.getQueryData<SidebarData>(sidebarKey);
  const entries: BulkFollowOptimisticContext["entries"] = [];

  for (const pub of publications) {
    const followKey = ["reader", "followStatus", pub.uri] as const;
    entries.push({
      publicationUri: pub.uri,
      prevFollow: queryClient.getQueryData<FollowStatus>(followKey),
    });
    queryClient.setQueryData<FollowStatus>(followKey, { isFollowing: true });
  }

  if (prevSidebar && publications.length > 0) {
    const current = prevSidebar.following ?? [];
    const byUri = new Map(current.map((item) => [item.uri, item]));
    for (const pub of publications) {
      byUri.set(pub.uri, {
        ...pub,
        unreadCount: byUri.get(pub.uri)?.unreadCount ?? 0,
      });
    }
    queryClient.setQueryData<SidebarData>(sidebarKey, {
      ...prevSidebar,
      following: sortFollowingPublications([...byUri.values()]),
    });
  }

  return { entries, prevSidebar };
}

export function rollbackBulkFollowOptimisticUpdate(
  queryClient: QueryClient,
  context: BulkFollowOptimisticContext,
) {
  const sidebarKey = ["feed", "sidebar"] as const;

  for (const { publicationUri, prevFollow } of context.entries) {
    const followKey = ["reader", "followStatus", publicationUri] as const;
    if (prevFollow) {
      queryClient.setQueryData(followKey, prevFollow);
    } else {
      queryClient.removeQueries({ queryKey: followKey });
    }
  }

  if (context.prevSidebar) {
    queryClient.setQueryData(sidebarKey, context.prevSidebar);
  }
}
