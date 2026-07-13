"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { useDragAndDrop, useFilter } from "react-aria-components";

import { listApi } from "#/integrations/tanstack-query/api-lists.functions";

import { Avatar } from "../../design-system/avatar";
import { Button } from "../../design-system/button";
import { ComboBox } from "../../design-system/combobox";
import { Dialog, DialogFooter, DialogHeader } from "../../design-system/dialog";
import { Flex } from "../../design-system/flex";
import { IconButton } from "../../design-system/icon-button";
import { ListBox, ListBoxItem } from "../../design-system/listbox";
import { Select, SelectItem } from "../../design-system/select";
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
import type {
  FollowingPublication,
  FollowingUser,
} from "../../integrations/tanstack-query/api-feed.functions";
import type { SubscriptionList } from "../../integrations/tanstack-query/api-lists.functions";
import { initials } from "./format";

const LISTS_QUERY_KEY = ["reader", "lists"] as const;
/** Public list pages (`/l/$did/$rkey`) keyed as ["list", did, rkey]. */
const LIST_PAGES_QUERY_KEY = ["list"] as const;

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
  },
  list: {
    borderColor: uiColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    maxHeight: "16rem",
    overflowY: "auto",
    paddingBottom: verticalSpace.xs,
    paddingTop: verticalSpace.xs,
  },
  emptyList: {
    color: uiColor.text1,
    display: "block",
    fontFamily: fontFamily.serif,
    fontSize: fontSize.sm,
    fontStyle: "italic",
    paddingBottom: verticalSpace.lg,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace.lg,
  },
  grip: {
    color: uiColor.text1,
    flexShrink: 0,
  },
  errorNote: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  footerSpacer: {
    flexGrow: 1,
  },
  addRow: {
    width: "100%",
  },
  addCombo: {
    flexGrow: 1,
    minWidth: 0,
  },
  addSelect: {
    flexShrink: 0,
  },
});

/** A list member: a subscribed publication (`pub`, id = at-uri) or a followed
 * user (`user`, id = did). Ids are unique across kinds. */
type MemberKind = "pub" | "user";
interface Member {
  kind: MemberKind;
  id: string;
}

interface MemberItem extends Member {
  name: string;
  iconUrl: string | null;
}

/** Display name for a followed user (display name, else handle, else DID). */
function userName(u: FollowingUser): string {
  return u.displayName ?? (u.handle ? `@${u.handle}` : u.did);
}

/** Reorder `members` per a react-aria drop event (move `keys` before/after target). */
function reorderMembers(
  members: Array<Member>,
  keys: Set<Key>,
  targetKey: Key,
  dropPosition: "before" | "after" | "on",
): Array<Member> {
  if (dropPosition === "on" || keys.has(targetKey)) {
    return members;
  }
  const moving = members.filter((member) => keys.has(member.id));
  const remaining = members.filter((member) => !keys.has(member.id));
  const targetIndex = remaining.findIndex((m) => m.id === String(targetKey));
  if (targetIndex === -1 || moving.length === 0) {
    return members;
  }
  const insertAt = dropPosition === "after" ? targetIndex + 1 : targetIndex;
  return [
    ...remaining.slice(0, insertAt),
    ...moving,
    ...remaining.slice(insertAt),
  ];
}

function ListEditForm({
  list,
  following,
  followingUsers,
  close,
  onDeleted,
}: {
  list: SubscriptionList | null;
  following: Array<FollowingPublication>;
  followingUsers: Array<FollowingUser>;
  close: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [members, setMembers] = useState<Array<Member>>(() => [
    ...(list?.publications ?? []).map(
      (uri): Member => ({ kind: "pub", id: uri }),
    ),
    ...(list?.users ?? []).map((did): Member => ({ kind: "user", id: did })),
  ]);
  const [mode, setMode] = useState<MemberKind>("pub");
  const [search, setSearch] = useState("");

  const saveMutation = useMutation(listApi.putListMutationOptions());
  const deleteMutation = useMutation(listApi.deleteListMutationOptions());
  const busy = saveMutation.isPending || deleteMutation.isPending;

  const pubByUri = new Map(following.map((pub) => [pub.uri, pub]));
  const userByDid = new Map(followingUsers.map((u) => [u.did, u]));

  const items: Array<MemberItem> = members.map((member) => {
    if (member.kind === "user") {
      const u = userByDid.get(member.id);
      // A list can reference someone the reader has since unfollowed — keep it
      // listed (so it can be removed) under its bare DID.
      return {
        ...member,
        name: u ? userName(u) : member.id,
        iconUrl: u?.avatarUrl ?? null,
      };
    }
    const pub = pubByUri.get(member.id);
    return {
      ...member,
      name: pub?.name ?? member.id.replace("at://", ""),
      iconUrl: pub?.iconUrl ?? pub?.ownerAvatarUrl ?? null,
    };
  });

  const memberIds = new Set(members.map((member) => member.id));
  const candidates: Array<MemberItem> =
    mode === "pub"
      ? following
          .filter((pub) => !memberIds.has(pub.uri))
          .map((pub) => ({
            kind: "pub",
            id: pub.uri,
            name: pub.name,
            iconUrl: pub.iconUrl ?? pub.ownerAvatarUrl,
          }))
      : followingUsers
          .filter((u) => !memberIds.has(u.did))
          .map((u) => ({
            kind: "user",
            id: u.did,
            name: userName(u),
            iconUrl: u.avatarUrl,
          }));

  const { contains } = useFilter({ sensitivity: "base" });
  // The input is controlled, so the combobox doesn't filter on its own.
  const matches = candidates.filter((item) => contains(item.name, search));
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder(event) {
      setMembers((current) =>
        reorderMembers(
          current,
          event.keys,
          event.target.key,
          event.target.dropPosition,
        ),
      );
    },
  });

  const removeMember = (id: string) => {
    setMembers((current) => current.filter((member) => member.id !== id));
  };

  const addMember = (kind: MemberKind, id: string) => {
    setMembers((current) =>
      current.some((member) => member.id === id)
        ? current
        : [...current, { kind, id }],
    );
    setSearch("");
  };

  const onSettled = () => {
    void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: LIST_PAGES_QUERY_KEY });
  };

  const save = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || busy) {
      return;
    }
    saveMutation.mutate(
      {
        rkey: list?.rkey,
        name: trimmed,
        publications: members
          .filter((member) => member.kind === "pub")
          .map((member) => member.id),
        users: members
          .filter((member) => member.kind === "user")
          .map((member) => member.id),
        description: description.trim() || undefined,
        createdAt: list?.createdAt ?? undefined,
      },
      { onSuccess: close, onSettled },
    );
  };

  const removeList = () => {
    if (!list || busy) {
      return;
    }
    deleteMutation.mutate(list.rkey, {
      onSuccess: () => {
        close();
        onDeleted?.();
      },
      onSettled,
    });
  };

  const error = saveMutation.error ?? deleteMutation.error;

  return (
    <>
      <div {...stylex.props(styles.body)}>
        <Flex direction="column" gap="2xl">
          <TextField
            label="Name"
            size="lg"
            placeholder="e.g. Tech, Friends, Cooking"
            value={name}
            onChange={setName}
            isRequired
          />

          <TextField
            label="Description"
            size="lg"
            placeholder="What this list is about (shown on its public page)"
            value={description}
            onChange={setDescription}
          />

          <ListBox
            aria-label="List members"
            size="lg"
            items={items}
            selectionMode="none"
            dragAndDropHooks={dragAndDropHooks}
            style={styles.list}
            renderEmptyState={() => (
              <span {...stylex.props(styles.emptyList)}>
                Nothing added yet — add publications or people below.
              </span>
            )}
          >
            {(item) => (
              <ListBoxItem
                id={item.id}
                textValue={item.name}
                prefix={
                  <Flex align="center" gap="md">
                    <GripVertical
                      aria-hidden
                      size={14}
                      {...stylex.props(styles.grip)}
                    />
                    <Avatar
                      size="sm"
                      src={item.iconUrl ?? undefined}
                      fallback={initials(item.name)}
                      alt={item.name}
                    />
                  </Flex>
                }
                suffix={
                  <IconButton
                    aria-label={`Remove ${item.name} from list`}
                    size="sm"
                    variant="tertiary"
                    onPress={() => removeMember(item.id)}
                  >
                    <X />
                  </IconButton>
                }
              >
                {item.name}
              </ListBoxItem>
            )}
          </ListBox>

          <Flex align="end" gap="lg" style={styles.addRow}>
            <ComboBox
              aria-label="Choose an item to add to the list"
              size="lg"
              placeholder={
                mode === "pub"
                  ? "Search your subscriptions"
                  : "Search people you follow"
              }
              items={matches}
              inputValue={search}
              onInputChange={setSearch}
              // Permanently unselected: picking an item adds it to the list and
              // the input resets, like a tag picker.
              selectedKey={null}
              onSelectionChange={(key) => {
                if (key != null) {
                  addMember(mode, String(key));
                }
              }}
              allowsEmptyCollection
              style={styles.addCombo}
              renderEmptyState={() => (
                <span {...stylex.props(styles.emptyList)}>
                  {candidates.length === 0
                    ? mode === "pub"
                      ? "All subscriptions are in this list."
                      : "Everyone you follow is in this list."
                    : mode === "pub"
                      ? "No matching subscriptions."
                      : "No matching people."}
                </span>
              )}
            >
              {(item) => (
                <ListBoxItem
                  id={item.id}
                  textValue={item.name}
                  prefix={
                    <Avatar
                      size="sm"
                      src={item.iconUrl ?? undefined}
                      fallback={initials(item.name)}
                      alt={item.name}
                    />
                  }
                >
                  {item.name}
                </ListBoxItem>
              )}
            </ComboBox>
            <Select
              size="lg"
              aria-label="Member type to add"
              selectedKey={mode}
              onSelectionChange={(key) => {
                setMode(String(key) as MemberKind);
                setSearch("");
              }}
              style={styles.addSelect}
              items={[
                { id: "pub", label: "Subscriptions" },
                { id: "user", label: "Follows" },
              ]}
            >
              {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
            </Select>
          </Flex>

          {error ? (
            <span {...stylex.props(styles.errorNote)}>
              {error instanceof Error ? error.message : "Something went wrong."}
            </span>
          ) : null}
        </Flex>
      </div>

      <DialogFooter>
        {list ? (
          <Button
            variant="critical-outline"
            isDisabled={busy}
            onPress={removeList}
          >
            Delete list
          </Button>
        ) : null}
        <span {...stylex.props(styles.footerSpacer)} aria-hidden />
        <Button
          variant="primary"
          isDisabled={busy || name.trim().length === 0}
          onPress={save}
        >
          {list ? "Save list" : "Create list"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Create / edit a publication list (`app.standard-reader.list`): rename,
 * describe, reorder (drag), remove, and add publications from the reader's
 * subscriptions.
 */
export function ListEditModal({
  isOpen,
  onOpenChange,
  list,
  following,
  followingUsers = [],
  onDeleted,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a new list. */
  list: SubscriptionList | null;
  following: Array<FollowingPublication>;
  followingUsers?: Array<FollowingUser>;
  /** Called after a list is deleted (e.g. navigate away from its public page). */
  onDeleted?: () => void;
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      fitContent
      trigger={<span hidden aria-hidden />}
    >
      <DialogHeader>
        <span {...stylex.props(styles.headerTitle)}>
          {list ? "Edit list" : "New list"}
        </span>
      </DialogHeader>
      <ListEditForm
        key={list?.uri ?? "new"}
        list={list}
        following={following}
        followingUsers={followingUsers}
        close={() => onOpenChange(false)}
        onDeleted={onDeleted}
      />
    </Dialog>
  );
}
