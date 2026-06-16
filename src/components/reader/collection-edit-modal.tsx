"use client";

import type { CollectionForEdit } from "#/integrations/tanstack-query/api-collections.functions";

import * as stylex from "@stylexjs/stylex";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { collectionsApi } from "#/integrations/tanstack-query/api-collections.functions";
import { searchApi } from "#/integrations/tanstack-query/api-search.functions";
import { ChevronDown, ChevronUp, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useFilter } from "react-aria-components";

import { Button } from "../../design-system/button";
import { ComboBox } from "../../design-system/combobox";
import { Dialog, DialogFooter, DialogHeader } from "../../design-system/dialog";
import { Flex } from "../../design-system/flex";
import { IconButton } from "../../design-system/icon-button";
import { ListBoxItem } from "../../design-system/listbox";
import { TextField } from "../../design-system/text-field";
import { uiColor } from "../../design-system/theme/color.stylex";
import { radius } from "../../design-system/theme/radius.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "../../design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  tracking,
} from "../../design-system/theme/typography.stylex";
import { MarkdownField } from "./markdown-field";

const COLLECTIONS_QUERY_KEY = ["reader", "collections"] as const;
const MAX_ITEMS = 16;

const styles = stylex.create({
  headerTitle: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.tight,
  },
  body: {
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    maxHeight: "70vh",
    overflowY: "auto",
  },
  sectionTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  itemRow: {
    borderColor: uiColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBottom: verticalSpace.lg,
    paddingLeft: horizontalSpace.lg,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.lg,
  },
  itemTitle: {
    color: uiColor.text2,
    flexGrow: 1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    minWidth: 0,
  },
  empty: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize.sm,
    fontStyle: "italic",
  },
  coverPreview: {
    backgroundColor: uiColor.component1,
    borderRadius: radius.md,
    height: "7rem",
    objectFit: "cover",
    width: "12rem",
  },
  hiddenInput: { display: "none" },
  errorNote: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  footerSpacer: { flexGrow: 1 },
});

interface BuilderItem {
  uri: string;
  title: string;
  note: string;
}

function moveItem(
  items: Array<BuilderItem>,
  index: number,
  delta: number,
): Array<BuilderItem> {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function CollectionForm({
  publicationUri,
  initial,
  close,
}: {
  publicationUri: string;
  initial?: CollectionForEdit | null;
  close: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [editorialTitle, setEditorialTitle] = useState(
    initial?.editorial?.title ?? "",
  );
  const [editorialBody, setEditorialBody] = useState(
    initial?.editorial?.body ?? "",
  );
  const [items, setItems] = useState<Array<BuilderItem>>(
    () =>
      initial?.items.map((item) => ({
        uri: item.document,
        title: item.title,
        note: item.note ?? "",
      })) ?? [],
  );
  const [search, setSearch] = useState("");
  const [coverImage, setCoverImage] = useState<Record<string, unknown> | null>(
    initial?.coverImage ?? null,
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(
    initial?.coverImageUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveMutation = useMutation(collectionsApi.putCollectionMutationOptions());
  const coverMutation = useMutation(
    collectionsApi.uploadCollectionCoverMutationOptions(),
  );
  const busy = saveMutation.isPending;

  const onCoverFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.slice(result.indexOf(",") + 1);
      if (!base64) return;
      coverMutation.mutate(
        { dataBase64: base64, mimeType: file.type },
        {
          onSuccess: (data) => {
            setCoverImage(data.blob);
            setCoverUrl(data.url ?? URL.createObjectURL(file));
          },
        },
      );
    };
    reader.readAsDataURL(file);
  };

  const removeCover = () => {
    setCoverImage(null);
    setCoverUrl(null);
  };

  const { data: searchData } = useInfiniteQuery(
    searchApi.searchArticlesInfiniteQueryOptions({ q: search }),
  );
  const chosen = new Set(items.map((item) => item.uri));
  const { contains } = useFilter({ sensitivity: "base" });
  const candidates = (searchData?.pages.flatMap((page) => page.items) ?? [])
    .filter((article) => !chosen.has(article.uri))
    .filter((article) => contains(article.title, search))
    .slice(0, 12);

  const addArticle = (uri: string) => {
    const article = searchData?.pages
      .flatMap((page) => page.items)
      .find((a) => a.uri === uri);
    if (!article || chosen.has(uri) || items.length >= MAX_ITEMS) return;
    setItems((current) => [
      ...current,
      { uri, title: article.title, note: "" },
    ]);
    setSearch("");
  };

  const removeItem = (uri: string) => {
    setItems((current) => current.filter((item) => item.uri !== uri));
  };

  const setNote = (uri: string, note: string) => {
    setItems((current) =>
      current.map((item) => (item.uri === uri ? { ...item, note } : item)),
    );
  };

  const save = () => {
    if (title.trim().length === 0 || items.length === 0 || busy) return;
    saveMutation.mutate(
      {
        publicationUri,
        rkey: initial?.rkey,
        title: title.trim(),
        editorial:
          editorialTitle.trim() || editorialBody.trim()
            ? {
                title: editorialTitle.trim() || undefined,
                body: editorialBody.trim() || undefined,
              }
            : undefined,
        items: items.map((item) => ({
          document: item.uri,
          note: item.note.trim() || undefined,
        })),
        coverImage,
      },
      {
        onSuccess: close,
        onSettled: () =>
          queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY }),
      },
    );
  };

  const error = saveMutation.error;

  return (
    <>
      <div {...stylex.props(styles.body)}>
        <Flex direction="column" gap="2xl">
          <TextField
            label="Title"
            placeholder="e.g. The Spring Reading Issue"
            value={title}
            onChange={setTitle}
            isRequired
          />

          <Flex direction="column" gap="md">
            <span {...stylex.props(styles.sectionTitle)}>Cover (optional)</span>
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Collection cover"
                {...stylex.props(styles.coverPreview)}
              />
            ) : null}
            <Flex align="center" gap="md">
              <Button
                variant="secondary"
                isDisabled={coverMutation.isPending}
                onPress={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={14} />{" "}
                {coverMutation.isPending
                  ? "Uploading…"
                  : coverUrl
                    ? "Replace cover"
                    : "Upload cover"}
              </Button>
              {coverUrl ? (
                <Button variant="tertiary" onPress={removeCover}>
                  Remove
                </Button>
              ) : null}
            </Flex>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              {...stylex.props(styles.hiddenInput)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCoverFile(file);
                e.target.value = "";
              }}
            />
          </Flex>

          <TextField
            label="Editorial heading (optional)"
            placeholder="A title for your intro"
            value={editorialTitle}
            onChange={setEditorialTitle}
          />
          <MarkdownField
            label="Editorial (optional)"
            value={editorialBody}
            onChange={setEditorialBody}
            placeholder="Introduce the collection… (markdown supported)"
          />

          <Flex direction="column" gap="md">
            <span {...stylex.props(styles.sectionTitle)}>
              Articles ({items.length}/{MAX_ITEMS})
            </span>
            {items.length === 0 ? (
              <span {...stylex.props(styles.empty)}>
                No articles yet — search below to add some.
              </span>
            ) : (
              items.map((item, index) => (
                <div key={item.uri} {...stylex.props(styles.itemRow)}>
                  <Flex direction="column" gap="md">
                    <Flex align="center" gap="md">
                      <span {...stylex.props(styles.itemTitle)}>
                        {index + 1}. {item.title}
                      </span>
                      <IconButton
                        aria-label="Move up"
                        size="sm"
                        variant="tertiary"
                        isDisabled={index === 0}
                        onPress={() => setItems((c) => moveItem(c, index, -1))}
                      >
                        <ChevronUp />
                      </IconButton>
                      <IconButton
                        aria-label="Move down"
                        size="sm"
                        variant="tertiary"
                        isDisabled={index === items.length - 1}
                        onPress={() => setItems((c) => moveItem(c, index, 1))}
                      >
                        <ChevronDown />
                      </IconButton>
                      <IconButton
                        aria-label={`Remove ${item.title}`}
                        size="sm"
                        variant="tertiary"
                        onPress={() => removeItem(item.uri)}
                      >
                        <X />
                      </IconButton>
                    </Flex>
                    <MarkdownField
                      label="Note (optional)"
                      value={item.note}
                      onChange={(note) => setNote(item.uri, note)}
                      placeholder="Why is this piece here? (markdown supported)"
                      rows={2}
                    />
                  </Flex>
                </div>
              ))
            )}
          </Flex>

          <ComboBox
            label="Add an article"
            placeholder="Search articles by title"
            items={candidates}
            inputValue={search}
            onInputChange={setSearch}
            selectedKey={null}
            onSelectionChange={(key) => {
              if (key != null) addArticle(String(key));
            }}
            allowsEmptyCollection
            renderEmptyState={() => (
              <span {...stylex.props(styles.empty)}>
                {search.trim().length === 0
                  ? "Type to search articles."
                  : "No matching articles."}
              </span>
            )}
          >
            {(article) => (
              <ListBoxItem id={article.uri} textValue={article.title}>
                {article.title}
              </ListBoxItem>
            )}
          </ComboBox>

          {error ? (
            <span {...stylex.props(styles.errorNote)}>
              {error instanceof Error ? error.message : "Something went wrong."}
            </span>
          ) : null}
        </Flex>
      </div>

      <DialogFooter>
        <span {...stylex.props(styles.footerSpacer)} aria-hidden />
        <Button
          variant="primary"
          isDisabled={busy || title.trim().length === 0 || items.length === 0}
          onPress={save}
        >
          {initial ? "Save collection" : "Create collection"}
        </Button>
      </DialogFooter>
    </>
  );
}

function CollectionEditLoader({
  rkey,
  publicationUri,
  close,
}: {
  rkey: string;
  publicationUri: string;
  close: () => void;
}) {
  const { data, isLoading } = useQuery(
    collectionsApi.getCollectionForEditQueryOptions(rkey),
  );
  if (isLoading) {
    return (
      <div {...stylex.props(styles.body)}>
        <span {...stylex.props(styles.empty)}>Loading collection…</span>
      </div>
    );
  }
  return (
    <CollectionForm
      publicationUri={publicationUri}
      initial={data ?? null}
      close={close}
    />
  );
}

/**
 * Create or edit a collection (title, optional editorial, ordered articles +
 * notes). Pass `rkey` to edit an existing collection.
 */
export function CollectionEditModal({
  isOpen,
  onOpenChange,
  publicationUri,
  rkey,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  publicationUri: string;
  rkey?: string | null;
}) {
  const close = () => onOpenChange(false);
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      fitContent
      trigger={<span hidden aria-hidden />}
    >
      <DialogHeader>
        <span {...stylex.props(styles.headerTitle)}>
          {rkey ? "Edit collection" : "New collection"}
        </span>
      </DialogHeader>
      {rkey ? (
        <CollectionEditLoader
          key={`edit-${rkey}-${isOpen ? "open" : "closed"}`}
          rkey={rkey}
          publicationUri={publicationUri}
          close={close}
        />
      ) : (
        <CollectionForm
          key={isOpen ? "open" : "closed"}
          publicationUri={publicationUri}
          close={close}
        />
      )}
    </Dialog>
  );
}
