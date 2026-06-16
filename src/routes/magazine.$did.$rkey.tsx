import type { ArticleDetail } from "#/integrations/tanstack-query/api-publication.functions";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { listApi } from "#/integrations/tanstack-query/api-lists.functions";
import { publicationApi } from "#/integrations/tanstack-query/api-publication.functions";
import { getPublicUrlClient } from "#/lib/public-url";
import { siteSocialMeta } from "#/lib/site-metadata";

import { composeIssue } from "../magazine/compose";
import { parseIssueIds, pinnedArticleUri } from "../magazine/issue-link";
import { Magazine } from "../magazine/Magazine";

import "../magazine/magazine.css";

/** Cap an edition to a sensible number of features for a single reading. */
const MAX_FEATURES = 16;

const magazineSearchSchema = z.object({
  // `did~rkey,…` — when present, pins the edition to exactly these articles so a
  // shared link keeps showing the same issue even as the list gains new posts.
  ids: z.string().optional(),
});

export const Route = createFileRoute("/magazine/$did/$rkey")({
  validateSearch: magazineSearchSchema,
  loaderDeps: ({ search }) => ({ ids: search.ids }),
  loader: async ({ context, params, deps }) => {
    const { queryClient } = context;
    const { did, rkey } = params;

    const pinned = deps.ids ? parseIssueIds(deps.ids) : [];

    // The masthead name/owner always come from the list, regardless of mode.
    const listPagePromise = queryClient.ensureQueryData(
      listApi.getListQueryOptions(did, rkey),
    );

    let articleUris: Array<string>;
    if (pinned.length > 0) {
      // Pinned edition: exactly these articles, in this order — stable forever.
      articleUris = pinned.slice(0, MAX_FEATURES).map(pinnedArticleUri);
    } else {
      // Live edition: the most recent renderable articles from the list today.
      const feed = await queryClient.ensureQueryData(
        listApi.getListFeedQueryOptions(did, rkey, {
          limit: MAX_FEATURES,
          offset: 0,
        }),
      );
      articleUris = feed.items
        .filter((item) => item.hasRenderableBody)
        .slice(0, MAX_FEATURES)
        .map((item) => item.uri);
    }

    const [listPage, details] = await Promise.all([
      listPagePromise,
      Promise.all(
        articleUris.map((uri) =>
          queryClient
            .ensureQueryData(publicationApi.getArticleQueryOptions(uri))
            .catch(() => null),
        ),
      ),
    ]);

    const articles = details.filter(
      (a): a is ArticleDetail => a != null,
    );

    return {
      listName: listPage.list?.name ?? "The Standard Issue",
      ownerHandle: listPage.owner?.handle ?? null,
      articles,
    };
  },
  head: ({ loaderData, match }) => {
    const name = loaderData?.listName ?? "Standard Reader";
    const baseUrl = getPublicUrlClient();
    return {
      meta: siteSocialMeta({
        title: `${name} · The Standard Issue`,
        description: `Read "${name}" as a magazine edition on Standard Reader.`,
        url: `${baseUrl}${match.pathname}`,
      }),
    };
  },
  component: MagazineRoute,
});

function MagazineRoute() {
  const { did, rkey } = Route.useParams();
  const { listName, ownerHandle, articles } = Route.useLoaderData();
  const navigate = useNavigate();

  const issue = useMemo(
    () => composeIssue(listName, ownerHandle, articles),
    [listName, ownerHandle, articles],
  );

  if (issue.features.length === 0) {
    return (
      <div className="mag">
        <div className="building">
          <div>
            <div style={{ marginBottom: 12 }}>Nothing to read here yet.</div>
            <button
              className="toc-btn show"
              style={{ position: "static" }}
              onClick={() => navigate({ to: "/l/$did/$rkey", params: { did, rkey } })}
            >
              Back to the list
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Magazine
      issue={issue}
      onExit={() => navigate({ to: "/l/$did/$rkey", params: { did, rkey } })}
    />
  );
}
