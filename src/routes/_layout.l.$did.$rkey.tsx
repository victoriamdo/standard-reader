import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { feedApi } from "#/integrations/tanstack-query/api-feed.functions";
import { listApi } from "#/integrations/tanstack-query/api-lists.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { getPublicUrlClient } from "#/lib/public-url";
import { listOgImageUrl, siteSocialMeta } from "#/lib/site-metadata";
import { Pencil } from "lucide-react";
import { useState } from "react";

import { PubDirectoryRow } from "../components/reader/cards";
import { ListEditModal } from "../components/reader/list-edit-modal";
import { ShareMenu } from "../components/reader/share-menu";
import { Handle, Kicker, ReaderContent } from "../components/reader/primitives";
import { Button } from "../design-system/button";
import { uiColor } from "../design-system/theme/color.stylex";
import { spacing } from "../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../design-system/theme/typography.stylex";

export const Route = createFileRoute("/_layout/l/$did/$rkey")({
  loader: async ({ context, params }) => {
    const page = await context.queryClient.ensureQueryData(
      listApi.getListQueryOptions(params.did, params.rkey),
    );
    return {
      listName: page.list?.name ?? null,
      listDescription: page.list?.description ?? null,
      ownerHandle: page.owner?.handle ?? null,
    };
  },
  head: ({ loaderData, match, params }) => {
    const name = loaderData?.listName;
    if (!name) {
      return { meta: [{ title: "Standard Reader" }] };
    }
    const baseUrl = getPublicUrlClient();
    const owner = loaderData?.ownerHandle;
    return {
      meta: siteSocialMeta({
        title: `${name} · Standard Reader`,
        description:
          loaderData?.listDescription?.trim() ||
          `A publication list${owner ? ` by @${owner}` : ""} on Standard Reader.`,
        url: `${baseUrl}${match.pathname}`,
        ogImage: listOgImageUrl(baseUrl, params.did, params.rkey),
      }),
    };
  },
  component: ListPage,
});

const styles = stylex.create({
  hero: {
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  heroInner: {
    alignItems: "flex-start",
    boxSizing: "border-box",
    columnGap: spacing["5"],
    display: "flex",
    flexWrap: "wrap",
    rowGap: spacing["4"],
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "1320px",
    paddingBottom: spacing["6"],
    paddingLeft: {
      default: spacing["5"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    paddingRight: {
      default: spacing["5"],
      "@media (min-width: 40rem)": spacing["10"],
    },
    paddingTop: spacing["6"],
    width: "100%",
  },
  heroInfo: {
    flexBasis: "0%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: "240px",
    paddingTop: spacing["0.5"],
  },
  heroName: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: { default: "1.85rem", "@media (min-width: 48rem)": "2rem" },
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.xs,
    marginBottom: spacing["0"],
    marginTop: spacing["2"],
  },
  heroDesc: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.sm,
    marginBottom: spacing["0"],
    marginTop: spacing["2"],
    maxWidth: "60ch",
  },
  handleLink: {
    textDecoration: { default: "none", ":hover": "underline" },
    color: "inherit",
    textUnderlineOffset: "2px",
  },
  stats: {
    alignItems: "baseline",
    color: uiColor.text1,
    columnGap: spacing["6"],
    display: "flex",
    flexWrap: "wrap",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    rowGap: spacing["2"],
    marginTop: spacing["4"],
  },
  statValue: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginRight: spacing["1"],
  },
  heroActs: {
    alignItems: "center",
    columnGap: spacing["1.5"],
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    rowGap: spacing["2.5"],
    paddingTop: spacing["1"],
  },
  pubList: {
    marginTop: spacing["8"],
    paddingBottom: spacing["10"],
  },
  emptyNote: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontStyle: "italic",
    textAlign: "center",
    paddingBottom: spacing["8"],
    paddingTop: spacing["8"],
  },
});

function ListPage() {
  const { did, rkey } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: page } = useSuspenseQuery(
    listApi.getListQueryOptions(did, rkey),
  );
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const signedIn = Boolean(session?.user);
  const { data: sidebar } = useQuery(feedApi.getSidebarQueryOptions());
  const following = sidebar?.following ?? [];

  const [editOpen, setEditOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["list", did, rkey] });
    void queryClient.invalidateQueries({
      queryKey: ["reader", "savedLists"],
    });
    // Saving a list acts like following its publications, so every feed
    // surface (sidebar, home, latest) changes too.
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  };
  const saveMutation = useMutation({
    ...listApi.saveListMutationOptions(),
    onSettled: invalidate,
  });
  const unsaveMutation = useMutation({
    ...listApi.unsaveListMutationOptions(),
    onSettled: invalidate,
  });
  const toggling = saveMutation.isPending || unsaveMutation.isPending;

  if (!page.list) {
    return (
      <ReaderContent>
        <div {...stylex.props(styles.emptyNote)}>
          We couldn’t find that list.
        </div>
      </ReaderContent>
    );
  }

  const { list, owner, publications, viewer } = page;

  const pageUrl = `${getPublicUrlClient()}/l/${did}/${rkey}`;

  return (
    <div>
      <div {...stylex.props(styles.hero)}>
        <div {...stylex.props(styles.heroInner)}>
          <div {...stylex.props(styles.heroInfo)}>
            <Kicker>Publication list</Kicker>
            <h1 {...stylex.props(styles.heroName)}>{list.name}</h1>
            {list.description ? (
              <p {...stylex.props(styles.heroDesc)}>{list.description}</p>
            ) : null}
            <div {...stylex.props(styles.stats)}>
              {owner?.handle ? (
                <a
                  href={`https://bsky.app/profile/${owner.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  {...stylex.props(styles.handleLink)}
                >
                  <Handle>by @{owner.handle}</Handle>
                </a>
              ) : null}
              <span>
                <span {...stylex.props(styles.statValue)}>
                  {list.publications.length}
                </span>
                {list.publications.length === 1
                  ? "publication"
                  : "publications"}
              </span>
            </div>
          </div>

          <div {...stylex.props(styles.heroActs)}>
            <ShareMenu pageUrl={pageUrl} />
            {viewer.isOwner ? (
              <Button variant="secondary" onPress={() => setEditOpen(true)}>
                <Pencil size={14} /> Edit list
              </Button>
            ) : signedIn ? (
              viewer.isSaved ? (
                <Button
                  variant="secondary"
                  isPending={toggling}
                  onPress={() => unsaveMutation.mutate(list.uri)}
                >
                  Remove list
                </Button>
              ) : (
                <Button
                  variant="primary"
                  isPending={toggling}
                  onPress={() => saveMutation.mutate(list.uri)}
                >
                  Follow list
                </Button>
              )
            ) : null}
          </div>
        </div>
      </div>

      <ReaderContent>
        <div {...stylex.props(styles.pubList)}>
          {publications.length === 0 ? (
            <div {...stylex.props(styles.emptyNote)}>
              This list is empty
              {viewer.isOwner ? " — add some publications to it." : "."}
            </div>
          ) : (
            publications.map((pub, index) => (
              <PubDirectoryRow
                key={pub.uri}
                pub={pub}
                rank={index + 1}
                isFirstInSection={index === 0}
                isLast={index === publications.length - 1}
              />
            ))
          )}
        </div>
      </ReaderContent>

      {viewer.isOwner ? (
        <ListEditModal
          isOpen={editOpen}
          onOpenChange={setEditOpen}
          list={list}
          following={following}
        />
      ) : null}
    </div>
  );
}
