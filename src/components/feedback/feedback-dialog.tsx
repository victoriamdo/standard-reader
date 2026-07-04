"use client";

import * as stylex from "@stylexjs/stylex";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "#/design-system/button";
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "#/design-system/dialog";
import { Flex } from "#/design-system/flex";
import { Link } from "#/design-system/link";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "#/design-system/segmented-control";
import { Separator } from "#/design-system/separator";
import { TextArea } from "#/design-system/text-area";
import { TextField } from "#/design-system/text-field";
import { criticalColor, uiColor } from "#/design-system/theme/color.stylex";
import { horizontalSpace } from "#/design-system/theme/semantic-spacing.stylex";
import { fontFamily, fontSize } from "#/design-system/theme/typography.stylex";
import { toasts } from "#/design-system/toast";
import { auth } from "#/integrations/tanstack-query/api-auth.functions";
import { userinputApi } from "#/integrations/tanstack-query/api-userinput.functions";
import { isAtprotoScopeMissingError } from "#/lib/atproto/scope-error";
import type { FeedbackTag } from "#/lib/userinput/space";
import { STANDARD_READER_FEEDBACK_TAGS } from "#/lib/userinput/space";

const styles = stylex.create({
  trigger: { display: "none" },
  body: {
    width: "100%",
  },
  content: {
    width: "100%",
  },
  fieldGroup: {
    width: "100%",
  },
  footerNote: {
    alignItems: "center",
    color: uiColor.text1,
    display: "flex",
    flexGrow: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    paddingRight: horizontalSpace.lg,
  },
  error: {
    color: criticalColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
});

export interface FeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEEDBACK_LIST_LIMIT = 50;
const DISCUSSION_POLL_INTERVAL_MS = 600;
const DISCUSSION_POLL_MAX_ATTEMPTS = 8;

/**
 * The feedback list is read from a constellation backlinks index that
 * observes writes via the AT Proto firehose — a discussion just written to
 * the reader's own repo doesn't show up there instantly. Poll briefly for it
 * to appear and seed the query cache with the confirming response, so the
 * `/feedback` list already reflects the new post once this resolves instead
 * of requiring a manual refresh. Best-effort: gives up silently if the
 * indexer is still catching up after the poll window — the list's normal
 * `staleTime` expiry picks it up eventually either way.
 */
async function waitForDiscussionToAppear(
  queryClient: QueryClient,
  uri: string,
): Promise<void> {
  const listOptions = userinputApi.getFeedbackDiscussionsQueryOptions({
    limit: FEEDBACK_LIST_LIMIT,
  });
  for (let attempt = 0; attempt < DISCUSSION_POLL_MAX_ATTEMPTS; attempt++) {
    const result = await userinputApi.listFeedbackDiscussions({
      data: { limit: FEEDBACK_LIST_LIMIT },
    });
    if (result.discussions.some((d) => d.uri === uri)) {
      queryClient.setQueryData(listOptions.queryKey, result);
      return;
    }
    if (attempt < DISCUSSION_POLL_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, DISCUSSION_POLL_INTERVAL_MS),
      );
    }
  }
}

/**
 * Submit-feedback dialog. Renders a tag chooser (bug / feature / question),
 * a required title, and an optional body. On Create:
 *
 *  - If the reader's OAuth grant already includes the userinput discussion
 *    scope, the record is created immediately and the dialog closes.
 *  - Otherwise the draft is stashed server-side, the `userinputFeedbackEnabled`
 *    flag is set, the current OAuth session is revoked, and the browser is
 *    sent through a fresh authorize flow on the default client with the
 *    userinput scope addendum. The callback returns to `/feedback/return`,
 *    which consumes the draft and creates the record.
 *
 * Mirrors the `atstore-review-prompt.tsx` controlled-dialog pattern (hidden
 * trigger, lifted `isOpen` state).
 */
export function FeedbackDialog({ isOpen, onOpenChange }: FeedbackDialogProps) {
  const [tag, setTag] = useState<FeedbackTag>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  // Reset the form whenever the dialog is closed so a reopen is clean.
  useEffect(() => {
    if (!isOpen) {
      setTag("bug");
      setTitle("");
      setBody("");
    }
  }, [isOpen]);

  const submitOrUpgrade = useMutation({
    mutationFn: async (): Promise<
      { authorizationUrl: string } | { uri: string; cid: string }
    > => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error("Please add a title.");
      }
      const trimmedBody = body.trim();

      try {
        const result = await userinputApi.createUserinputDiscussion({
          data: {
            title: trimmedTitle,
            ...(trimmedBody ? { body: trimmedBody } : {}),
            tag,
          },
        });
        await waitForDiscussionToAppear(queryClient, result.uri);
        return result;
      } catch (error) {
        if (!isAtprotoScopeMissingError(error, "app.userinput.discussion")) {
          throw error;
        }
        // Scope missing — stash the draft, then kick off the upgrade flow.
        // The landing page consumes the draft and creates the record after
        // OAuth completes.
        const draft = await userinputApi.createFeedbackDraft({
          data: {
            title: trimmedTitle,
            ...(trimmedBody ? { body: trimmedBody } : {}),
            tag,
          },
        });
        const result = await auth.upgradeToUserinputFeedback({
          data: { redirect: `/feedback/return?draft=${draft.id}` },
        });
        return { authorizationUrl: result.authorizationUrl };
      }
    },
    onSuccess: (result) => {
      if ("authorizationUrl" in result && result.authorizationUrl) {
        globalThis.location.href = result.authorizationUrl;
        return;
      }
      onOpenChange(false);
      toasts.add({
        title: "Feedback submitted",
        description:
          "Thanks for taking the time to help us improve Standard Reader.",
      });
    },
    onError: (error) => {
      toasts.add({
        title: "Could not submit feedback",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    },
  });

  const error = submitOrUpgrade.error;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          submitOrUpgrade.reset();
        }
      }}
      size="md"
      fitContent
      trigger={<span hidden aria-hidden {...stylex.props(styles.trigger)} />}
    >
      <DialogHeader>Submit feedback</DialogHeader>
      <DialogDescription>
        Posted to our{" "}
        <Link
          href="https://userinput.app/#/s/did:plc:f4os2wz5fjl56xpwcvtnqu7m/3mprrc56lgd2e"
          target="_blank"
          rel="noopener noreferrer"
        >
          feedback board
        </Link>{" "}
        on userinput.app. You may be asked to grant permission the first time.
      </DialogDescription>
      <Separator />
      <DialogBody style={styles.body}>
        <Flex direction="column" gap="2xl" style={styles.content}>
          <SegmentedControl
            aria-label="Feedback type"
            selectedKeys={new Set([tag])}
            size="lg"
            onSelectionChange={(keys) => {
              const next = [...keys][0] as FeedbackTag | undefined;
              if (next) setTag(next);
            }}
          >
            {STANDARD_READER_FEEDBACK_TAGS.map((t) => (
              <SegmentedControlItem key={t.value} id={t.value}>
                {t.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>

          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="Summarize your feedback"
            isRequired
            style={styles.fieldGroup}
          />

          <TextArea
            label="Details"
            aria-label="Details"
            placeholder="Optional: add context, steps to reproduce, or what you'd like to see"
            value={body}
            onChange={setBody}
            rows={5}
            autosize={false}
          />

          {error ? (
            <span {...stylex.props(styles.error)}>
              {error instanceof Error
                ? error.message
                : "Something went wrong while submitting your feedback."}
            </span>
          ) : null}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <span {...stylex.props(styles.footerNote)}>
          Create posts to your AT Protocol repo.
        </span>
        <Button
          variant="primary"
          isDisabled={title.trim().length === 0}
          isPending={submitOrUpgrade.isPending}
          onPress={() => submitOrUpgrade.mutate()}
        >
          Create
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
