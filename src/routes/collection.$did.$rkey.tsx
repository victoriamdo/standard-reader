"use client";

import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { exitMagazineViewer } from "#/lib/exit-magazine-viewer";
import { collectionReaderViewSearch } from "#/lib/open-collections-in-magazine";
import { getPublicUrlClient } from "#/lib/public-url";
import { siteSocialMeta } from "#/lib/site-metadata";
import { useOpenCollectionsInMagazine } from "#/lib/use-open-collections-in-magazine";
import { useMemo } from "react";
import { z } from "zod";

import type { MagazineShellData } from "../magazine/types";

import { documentUriFromParams } from "../components/reader/format";
import { publicationApi } from "../integrations/tanstack-query/api-publication.functions";
import { composeCollectionIssue, composeIssue } from "../magazine/compose";
import { magazineThemeFontHeadLinks } from "../magazine/font-preload";
import {
  bootstrapFromCollectionData,
  getCollectionMagazineQueryOptions,
  getMagazineDataQueryOptions,
  seedCollectionMagazineCaches,
  shellFromArticle,
  shellFromCollectionData,
} from "../magazine/load-magazine-data";
import { Magazine } from "../magazine/Magazine";
import { MagazineShell } from "../magazine/magazine-shell";
import "../magazine/magazine.css";

const collectionSearchSchema = z.object({
  // `did~rkey,…` — when present, pins the edition to exactly these articles so a
  // shared link keeps showing the same issue even as the list gains new posts.
  ids: z.string().optional(),
});

function collectionPendingLabel(shell: MagazineShellData | null | undefined) {
  return shell?.isCollection === false
    ? "Opening the issue…"
    : "Opening the collection…";
}

function CollectionPendingView({
  shell,
}: {
  shell: MagazineShellData | null | undefined;
}) {
  return (
    <MagazineShell
      theme={shell?.theme ?? null}
      aria-busy="true"
      aria-label="Loading collection"
    >
      <div className="building">
        <div>
          <div className="spin" />
          {collectionPendingLabel(shell)}
        </div>
      </div>
    </MagazineShell>
  );
}

export function CollectionPending() {
  return <CollectionPendingView shell={null} />;
}

export const Route = createFileRoute("/collection/$did/$rkey")({
  validateSearch: collectionSearchSchema,
  loaderDeps: ({ search }) => ({ ids: search.ids }),
  loader: async ({ context, params, preload, deps }) => {
    const uri = documentUriFromParams(params.did, params.rkey);
    const collectionOptions = getCollectionMagazineQueryOptions(params);
    const listDataOptions = getMagazineDataQueryOptions(params, deps);

    if (preload) {
      void context.queryClient.prefetchQuery(collectionOptions);
      void context.queryClient.prefetchQuery(listDataOptions);
      return { shell: null, isListMode: null as boolean | null };
    }

    const collection = await context.queryClient
      .ensureQueryData(collectionOptions)
      .catch(() => null);

    if (collection) {
      seedCollectionMagazineCaches(context.queryClient, collection);
      return {
        shell: shellFromCollectionData(collection),
        isListMode: false,
      };
    }

    void context.queryClient.prefetchQuery(listDataOptions);

    const article = await context.queryClient.ensureQueryData(
      publicationApi.getArticleQueryOptions(uri),
    );
    return {
      shell: shellFromArticle(article),
      isListMode: !article?.collection,
    };
  },
  pendingComponent: CollectionPending,
  pendingMs: 0,
  head: ({ loaderData, match }) => {
    const baseUrl = getPublicUrlClient();
    const theme = loaderData?.shell?.theme;
    return {
      meta: siteSocialMeta({
        title: "The Standard Issue · Standard Reader",
        description: "Read a collection edition on Standard Reader.",
        url: `${baseUrl}${match.pathname}`,
      }),
      links: magazineThemeFontHeadLinks(theme),
    };
  },
  component: CollectionRoute,
});

function CollectionRoute() {
  const { did, rkey } = Route.useParams();
  const { ids } = Route.useSearch();
  const { shell, isListMode: loaderIsListMode } = Route.useLoaderData();
  const isClient = globalThis.window !== undefined;
  const isListMode = loaderIsListMode === true;

  const { data: collection, isPending: collectionPending } = useQuery({
    ...getCollectionMagazineQueryOptions({ did, rkey }),
    enabled: isClient && loaderIsListMode === false,
  });

  const { data: listData, isPending: listPending } = useQuery({
    ...getMagazineDataQueryOptions({ did, rkey }, { ids }),
    enabled: isClient && isListMode,
  });

  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { openInMagazine } = useOpenCollectionsInMagazine();

  const issue = useMemo(() => {
    if (isListMode) {
      if (!listData || listData.mode !== "list") return null;
      return composeIssue(
        listData.name,
        listData.ownerHandle,
        listData.articles,
      );
    }
    if (!collection) return null;
    return composeCollectionIssue({
      ...bootstrapFromCollectionData(collection),
      features: collection.features,
    });
  }, [collection, isListMode, listData]);

  const publicationParams = isListMode
    ? null
    : (collection?.publicationParams ?? null);

  if (!isClient || !shell) {
    return <CollectionPendingView shell={shell} />;
  }

  if (isListMode) {
    if (listPending || !issue) {
      return <CollectionPendingView shell={shell} />;
    }
  } else if (collectionPending || !issue) {
    return <CollectionPendingView shell={shell} />;
  }

  if (issue.features.length === 0) {
    return (
      <MagazineShell theme={issue.theme ?? null}>
        <div className="building">
          <div>
            <div style={{ marginBottom: 12 }}>Nothing to read here yet.</div>
            <button
              className="toc-btn show"
              style={{ position: "static" }}
              onClick={() => {
                exitMagazineViewer({
                  history: router.history,
                  canGoBack,
                  openInMagazine,
                  mode: isListMode ? "list" : "collection",
                  did,
                  rkey,
                  publicationParams,
                  onNavigate: (target) => {
                    void navigate(target);
                  },
                });
              }}
            >
              Go back
            </button>
          </div>
        </div>
      </MagazineShell>
    );
  }

  const openReader = () => {
    if (isListMode) {
      void navigate({ to: "/l/$did/$rkey", params: { did, rkey } });
      return;
    }
    void navigate({
      to: "/a/$did/$rkey",
      params: { did, rkey },
      search: collectionReaderViewSearch,
    });
  };

  const closeViewer = () => {
    exitMagazineViewer({
      history: router.history,
      canGoBack,
      openInMagazine,
      mode: isListMode ? "list" : "collection",
      did,
      rkey,
      publicationParams,
      onNavigate: (target) => {
        void navigate(target);
      },
    });
  };

  return (
    <Magazine issue={issue} onExit={closeViewer} onOpenReader={openReader} />
  );
}
