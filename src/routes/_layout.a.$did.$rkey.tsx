import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { publicationApi } from "#/integrations/tanstack-query/api-publication.functions";
import { readerApi } from "#/integrations/tanstack-query/api-reader.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";

import {
  ArticleNotFound,
  ArticleView,
} from "../components/reader/article-view";
import { documentUriFromParams } from "../components/reader/format";

export const Route = createFileRoute("/_layout/a/$did/$rkey")({
  loader: async ({ context, params }) => {
    const uri = documentUriFromParams(params.did, params.rkey);
    const article = await context.queryClient.ensureQueryData(
      publicationApi.getArticleQueryOptions(uri),
    );
    if (article) {
      await context.queryClient.ensureQueryData(
        readerApi.getBookmarkStatusQueryOptions(uri),
      );
      if (article.publicationUri) {
        await context.queryClient.ensureQueryData(
          readerApi.getFollowStatusQueryOptions(article.publicationUri),
        );
      }
    }
    await context.queryClient.ensureQueryData(user.getSessionQueryOptions);
  },
  component: ArticleRoute,
});

function ArticleRoute() {
  const { did, rkey } = Route.useParams();
  const uri = documentUriFromParams(did, rkey);
  const { data: article } = useSuspenseQuery(
    publicationApi.getArticleQueryOptions(uri),
  );

  if (!article) {
    return <ArticleNotFound />;
  }

  return <ArticleView article={article} />;
}
