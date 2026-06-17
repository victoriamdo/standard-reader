"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  applyFollowOptimisticUpdate,
  invalidateFollowQueries,
  rollbackFollowOptimisticUpdate,
} from "#/components/reader/follow-optimistic";
import { listApi } from "#/integrations/tanstack-query/api-lists.functions";
import { readerApi } from "#/integrations/tanstack-query/api-reader.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { useLoginSearch } from "#/utils/use-login-search";

import type { MagSubscribeTarget } from "./types";

function SubscribeButton({
  label,
  pending,
  following,
  onPress,
}: {
  label: string;
  pending: boolean;
  following: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={`endcard-subscribe-btn${following ? " is-following" : ""}`}
      disabled={pending}
      onClick={onPress}
    >
      {pending ? "Subscribing…" : label}
    </button>
  );
}

function PublicationEndSubscribe({
  target,
}: {
  target: Extract<MagSubscribeTarget, { kind: "publication" }>;
}) {
  const loginSearch = useLoginSearch();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);

  const { data: followStatus } = useQuery({
    ...readerApi.getFollowStatusQueryOptions(target.uri),
    enabled: signedIn,
  });
  const following = followStatus?.isFollowing ?? false;

  const followMutation = useMutation(
    readerApi.followPublicationMutationOptions(),
  );
  const unfollowMutation = useMutation(
    readerApi.unfollowPublicationMutationOptions(),
  );
  const pending = followMutation.isPending || unfollowMutation.isPending;

  if (!signedIn) {
    return (
      <Link
        to="/login"
        search={{ ...loginSearch, intent: "subscribe" }}
        className="endcard-subscribe-btn"
      >
        Subscribe
      </Link>
    );
  }

  const onPress = () => {
    const next = !following;
    const mutation = next ? followMutation : unfollowMutation;
    const optimistic = applyFollowOptimisticUpdate(queryClient, {
      publicationUri: target.uri,
      following: next,
    });
    mutation.mutate(target.uri, {
      onError: () =>
        rollbackFollowOptimisticUpdate(queryClient, target.uri, optimistic),
      onSettled: () => invalidateFollowQueries(queryClient),
    });
  };

  return (
    <SubscribeButton
      label={following ? "Following" : "Subscribe"}
      pending={pending}
      following={following}
      onPress={onPress}
    />
  );
}

function ListEndSubscribe({
  target,
}: {
  target: Extract<MagSubscribeTarget, { kind: "list" }>;
}) {
  const loginSearch = useLoginSearch();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);

  const { data: listPage } = useQuery(
    listApi.getListQueryOptions(target.did, target.rkey),
  );
  const saved = listPage?.viewer.isSaved ?? false;

  const saveMutation = useMutation(listApi.saveListMutationOptions());
  const unsaveMutation = useMutation(listApi.unsaveListMutationOptions());
  const pending = saveMutation.isPending || unsaveMutation.isPending;

  if (!signedIn) {
    return (
      <Link to="/login" search={loginSearch} className="endcard-subscribe-btn">
        Follow list
      </Link>
    );
  }

  const onPress = () => {
    if (saved) {
      unsaveMutation.mutate(target.uri);
      return;
    }
    saveMutation.mutate(target.uri);
  };

  return (
    <SubscribeButton
      label={saved ? "Following list" : "Follow list"}
      pending={pending}
      following={saved}
      onPress={onPress}
    />
  );
}

export function MagazineEndSubscribe({
  target,
}: {
  target: MagSubscribeTarget;
}) {
  if (target.kind === "publication") {
    return <PublicationEndSubscribe target={target} />;
  }
  return <ListEndSubscribe target={target} />;
}
