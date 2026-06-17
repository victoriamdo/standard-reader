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

import { composeCollectionIssue, composeIssue } from "../magazine/compose";
import {
  fetchMagazineFontPreloadLinks,
  magazineThemeFontHeadLinks,
} from "../magazine/font-preload";
import {
  getMagazineDataQueryOptions,
  getMagazineShellQueryOptions,
  type MagazineShellData,
} from "../magazine/load-magazine-data";
import { Magazine } from "../magazine/Magazine";
import { MagazineShell } from "../magazine/magazine-shell";
import "../magazine/magazine.css";

const magazineSearchSchema = z.object({
  // `did~rkey,…` — when present, pins the edition to exactly these articles so a
  // shared link keeps showing the same issue even as the list gains new posts.
  ids: z.string().optional(),
});

function magazinePendingLabel(shell: MagazineShellData | null | undefined) {
  return shell?.isCollection === false
    ? "Opening the issue…"
    : "Opening the collection…";
}

function MagazinePendingView({
  shell,
}: {
  shell: MagazineShellData | null | undefined;
}) {
  return (
    <MagazineShell
      theme={shell?.theme ?? null}
      aria-busy="true"
      aria-label="Loading magazine"
    >
      <div className="building">
        <div>
          <div className="spin" />
          {magazinePendingLabel(shell)}
        </div>
      </div>
    </MagazineShell>
  );
}

export function MagazinePending() {
  const { shell } = Route.useLoaderData();
  return <MagazinePendingView shell={shell} />;
}

export const Route = createFileRoute("/magazine/$did/$rkey")({
  validateSearch: magazineSearchSchema,
  loader: async ({ context, params, preload }) => {
    const shellOptions = getMagazineShellQueryOptions(params);
    if (preload) {
      void context.queryClient.prefetchQuery(shellOptions);
      return { shell: null, fontPreloads: [] };
    }
    const shell = await context.queryClient.ensureQueryData(shellOptions);
    const fontPreloads = await fetchMagazineFontPreloadLinks(shell.theme);
    return { shell, fontPreloads };
  },
  pendingComponent: MagazinePending,
  pendingMs: 0,
  head: ({ loaderData, match }) => {
    const baseUrl = getPublicUrlClient();
    const theme = loaderData?.shell?.theme;
    return {
      meta: siteSocialMeta({
        title: "The Standard Issue · Standard Reader",
        description: "Read a magazine edition on Standard Reader.",
        url: `${baseUrl}${match.pathname}`,
      }),
      links: [
        ...magazineThemeFontHeadLinks(theme),
        ...(loaderData?.fontPreloads ?? []),
      ],
    };
  },
  component: MagazineRoute,
});

function MagazineRoute() {
  const { did, rkey } = Route.useParams();
  const { ids } = Route.useSearch();
  const { shell } = Route.useLoaderData();
  const isClient = globalThis.window !== undefined;
  const { data, isPending } = useQuery({
    ...getMagazineDataQueryOptions({ did, rkey }, { ids }),
    // Full issue composition stays client-side so navigations never block on
    // fetching every feature article.
    enabled: isClient,
  });
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { openInMagazine } = useOpenCollectionsInMagazine();

  const issue = useMemo(() => {
    if (!data) return null;
    if (data.mode === "collection") {
      return composeCollectionIssue({
        name: data.name,
        publicationName: data.publicationName,
        ownerHandle: data.ownerHandle,
        editorial: data.editorial,
        coverImageUrl: data.coverImageUrl,
        theme: data.theme,
        features: data.features,
      });
    }
    return composeIssue(data.name, data.ownerHandle, data.articles);
  }, [data]);

  if (!isClient || isPending || !data || !issue) {
    return <MagazinePendingView shell={shell} />;
  }

  const openReader = () => {
    if (data.mode === "collection") {
      void navigate({
        to: "/a/$did/$rkey",
        params: { did, rkey },
        search: collectionReaderViewSearch,
      });
    } else {
      void navigate({ to: "/l/$did/$rkey", params: { did, rkey } });
    }
  };

  const closeViewer = () => {
    exitMagazineViewer({
      history: router.history,
      canGoBack,
      openInMagazine,
      mode: data.mode,
      did,
      rkey,
      publicationParams:
        data.mode === "collection" ? data.publicationParams : null,
      onNavigate: (target) => {
        void navigate(target);
      },
    });
  };

  if (issue.features.length === 0) {
    return (
      <MagazineShell theme={issue.theme ?? null}>
        <div className="building">
          <div>
            <div style={{ marginBottom: 12 }}>Nothing to read here yet.</div>
            <button
              className="toc-btn show"
              style={{ position: "static" }}
              onClick={closeViewer}
            >
              Go back
            </button>
          </div>
        </div>
      </MagazineShell>
    );
  }

  return (
    <Magazine issue={issue} onExit={closeViewer} onOpenReader={openReader} />
  );
}
