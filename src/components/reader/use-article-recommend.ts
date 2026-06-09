"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { readerApi } from "#/integrations/tanstack-query/api-reader.functions";
import { useLoginSearch } from "#/utils/use-login-search";
import { useEffect, useState } from "react";

export function useArticleRecommend(documentUri: string, signedIn: boolean) {
  const navigate = useNavigate();
  const loginSearch = useLoginSearch();
  const queryClient = useQueryClient();

  const { data: status } = useSuspenseQuery(
    readerApi.getRecommendStatusQueryOptions(documentUri),
  );

  const [recommended, setRecommended] = useState(status.isRecommended);

  useEffect(() => {
    setRecommended(status.isRecommended);
  }, [status.isRecommended]);

  const recommendMutation = useMutation(
    readerApi.recommendDocumentMutationOptions(),
  );
  const unrecommendMutation = useMutation(
    readerApi.unrecommendDocumentMutationOptions(),
  );

  const toggle = () => {
    if (!signedIn) {
      void navigate({ to: "/login", search: loginSearch });
      return;
    }
    const next = !recommended;
    setRecommended(next);
    const mutation = next ? recommendMutation : unrecommendMutation;
    mutation.mutate(documentUri, {
      onError: () => setRecommended(!next),
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: ["reader", "recommendStatus", documentUri],
        });
        void queryClient.invalidateQueries({
          queryKey: ["article", documentUri],
        });
      },
    });
  };

  const isPending =
    recommendMutation.isPending || unrecommendMutation.isPending;

  return { recommended, toggle, isPending };
}
