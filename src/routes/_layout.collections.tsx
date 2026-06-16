"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { collectionsApi } from "#/integrations/tanstack-query/api-collections.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { getPublicUrlClient } from "#/lib/public-url";
import { siteSocialMeta } from "#/lib/site-metadata";
import { buildAuthRedirectPath } from "#/utils/auth-redirect";
import { BookOpen, Layers, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { CollectionEditModal } from "../components/reader/collection-edit-modal";
import { CollectionThemeEditor } from "../components/reader/collection-theme-editor";
import { Masthead, ReaderContent } from "../components/reader/primitives";
import { ShareMenu } from "../components/reader/share-menu";
import { Button } from "../design-system/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "../design-system/dialog";
import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import { TextField } from "../design-system/text-field";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { spacing } from "../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "../design-system/theme/typography.stylex";

const COLLECTIONS_QUERY_KEY = ["reader", "collections"] as const;

export const Route = createFileRoute("/_layout/collections")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: buildAuthRedirectPath("/collections") },
      });
    }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        collectionsApi.getMyCollectionsQueryOptions(),
      ),
      context.queryClient.ensureQueryData(
        collectionsApi.getCollectionsPublicationQueryOptions(),
      ),
    ]);
  },
  head: () => ({
    meta: siteSocialMeta({
      title: "Collections · Standard Reader",
      description:
        "Curated, magazine-rendered editions you assemble from articles across the network.",
      url: `${getPublicUrlClient()}/collections`,
    }),
  }),
  component: CollectionsPage,
});

const styles = stylex.create({
  card: {
    alignItems: "center",
    borderColor: uiColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    columnGap: spacing["4"],
    display: "flex",
    flexWrap: "wrap",
    marginTop: spacing["4"],
    paddingBottom: spacing["4"],
    paddingLeft: spacing["5"],
    paddingRight: spacing["5"],
    paddingTop: spacing["4"],
    rowGap: spacing["3"],
  },
  cardInfo: { flexGrow: 1, minWidth: "12rem" },
  cardTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.xs,
    textDecoration: { default: "none", ":hover": "underline" },
  },
  cardMeta: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    marginTop: spacing["1"],
  },
  cardActs: { alignItems: "center", columnGap: spacing["1.5"], display: "flex" },
  empty: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontStyle: "italic",
    paddingBottom: spacing["8"],
    paddingTop: spacing["8"],
  },
});

function CollectionsPage() {
  const queryClient = useQueryClient();
  const { data: collections } = useSuspenseQuery(
    collectionsApi.getMyCollectionsQueryOptions(),
  );
  const { data: publication } = useSuspenseQuery(
    collectionsApi.getCollectionsPublicationQueryOptions(),
  );

  const [pubUri, setPubUri] = useState<string | null>(publication?.uri ?? null);
  const [nameOpen, setNameOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRkey, setEditingRkey] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [pubName, setPubName] = useState("");

  const ensureMutation = useMutation(
    collectionsApi.ensureCollectionsPublicationMutationOptions(),
  );
  const deleteMutation = useMutation(
    collectionsApi.deleteCollectionMutationOptions(),
  );

  const baseUrl = getPublicUrlClient();

  const onNew = () => {
    setEditingRkey(null);
    if (pubUri) {
      setBuilderOpen(true);
    } else {
      setNameOpen(true);
    }
  };

  const onEdit = (rkey: string) => {
    if (!pubUri) return;
    setEditingRkey(rkey);
    setBuilderOpen(true);
  };

  const createPublication = () => {
    const name = pubName.trim();
    if (name.length === 0 || ensureMutation.isPending) return;
    ensureMutation.mutate(
      { name },
      {
        onSuccess: (result) => {
          setPubUri(result.uri);
          setNameOpen(false);
          setBuilderOpen(true);
          void queryClient.invalidateQueries({
            queryKey: ["reader", "collectionsPublication"],
          });
        },
      },
    );
  };

  const remove = (rkey: string) => {
    deleteMutation.mutate(rkey, {
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY }),
    });
  };

  return (
    <ReaderContent>
      <Masthead
        kicker="Your profile"
        kickerIcon={<Layers size={14} aria-hidden />}
        title="Collections"
        dek="Curated, magazine-rendered editions you assemble from articles across the network."
        metaLabel="Collections"
        metaValue={String(collections.length)}
      />

      <Flex justify="end" gap="sm">
        {publication ? (
          <Button variant="secondary" onPress={() => setThemeOpen(true)}>
            Theme &amp; fonts
          </Button>
        ) : null}
        <Button variant="primary" onPress={onNew}>
          New collection
        </Button>
      </Flex>

      {collections.length === 0 ? (
        <div {...stylex.props(styles.empty)}>
          No collections yet — create your first one.
        </div>
      ) : (
        collections.map((collection) => (
          <div key={collection.uri} {...stylex.props(styles.card)}>
            <div {...stylex.props(styles.cardInfo)}>
              <Link
                to="/a/$did/$rkey"
                params={{ did: collection.did, rkey: collection.rkey }}
                {...stylex.props(styles.cardTitle)}
              >
                {collection.title}
              </Link>
              <div {...stylex.props(styles.cardMeta)}>
                {collection.itemCount}{" "}
                {collection.itemCount === 1 ? "article" : "articles"}
                {collection.hasEditorial ? " · editorial" : ""}
              </div>
            </div>
            <div {...stylex.props(styles.cardActs)}>
              <Link
                to="/magazine/$did/$rkey"
                params={{ did: collection.did, rkey: collection.rkey }}
              >
                <IconButton variant="secondary" label="Launch magazine">
                  <BookOpen size={16} />
                </IconButton>
              </Link>
              <IconButton
                variant="secondary"
                label="Edit collection"
                onPress={() => onEdit(collection.rkey)}
              >
                <Pencil size={16} />
              </IconButton>
              <ShareMenu
                pageUrl={`${baseUrl}/a/${collection.did}/${collection.rkey}`}
                variant="icon"
              />
              <IconButton
                variant="critical-outline"
                label="Delete collection"
                isDisabled={deleteMutation.isPending}
                onPress={() => remove(collection.rkey)}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
        ))
      )}

      <Dialog
        isOpen={nameOpen}
        onOpenChange={setNameOpen}
        size="sm"
        fitContent
        trigger={<span hidden aria-hidden />}
      >
        <DialogHeader>Name your collections</DialogHeader>
        <DialogBody>
          <TextField
            label="Publication name"
            placeholder="e.g. Andrew’s Reading Room"
            value={pubName}
            onChange={setPubName}
            isRequired
            description="This holds all your collections and is what others follow."
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onPress={() => setNameOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={pubName.trim().length === 0 || ensureMutation.isPending}
            onPress={createPublication}
          >
            Continue
          </Button>
        </DialogFooter>
      </Dialog>

      {pubUri ? (
        <CollectionEditModal
          isOpen={builderOpen}
          onOpenChange={(open) => {
            setBuilderOpen(open);
            if (!open) setEditingRkey(null);
          }}
          publicationUri={pubUri}
          rkey={editingRkey}
        />
      ) : null}

      {publication ? (
        <CollectionThemeEditor
          isOpen={themeOpen}
          onOpenChange={setThemeOpen}
          theme={publication.theme}
        />
      ) : null}
    </ReaderContent>
  );
}
