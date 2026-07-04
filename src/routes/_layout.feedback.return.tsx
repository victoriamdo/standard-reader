"use client";

import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Button } from "#/design-system/button";
import { Flex } from "#/design-system/flex";
import { Link } from "#/design-system/link";
import { uiColor } from "#/design-system/theme/color.stylex";
import { breakpoints } from "#/design-system/theme/media-queries.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  tracking,
} from "#/design-system/theme/typography.stylex";
import { userinputApi } from "#/integrations/tanstack-query/api-userinput.functions";

const searchSchema = z.object({
  draft: z.string().min(1).optional(),
  upvote: z.string().min(1).optional(),
  // OAuth callback appends these; we don't use them but accept them so the
  // route doesn't 400 on the post-callback URL.
  loginSuccess: z.union([z.string(), z.boolean()]).optional(),
  handle: z.string().optional(),
  avatar: z.string().optional(),
});

type ReturnOutcome =
  | { kind: "success"; uri: string }
  | { kind: "upvoted"; uri: string }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export const Route = createFileRoute("/_layout/feedback/return")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    draft: search.draft,
    upvote: search.upvote,
  }),
  loader: async ({ deps }): Promise<ReturnOutcome> => {
    // Upvote draft path: stashed before the OAuth round-trip when the reader
    // tried to upvote without the userinput upvote scope.
    if (deps.upvote) {
      try {
        const draft = await userinputApi.consumeUpvoteDraft({
          data: { draftId: deps.upvote },
        });
        if (!draft) {
          return { kind: "expired" };
        }
        const result = await userinputApi.createUserinputUpvote({
          data: { subjectUri: draft.subjectUri },
        });
        return { kind: "upvoted", uri: result.uri };
      } catch (error) {
        return {
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while upvoting.",
        };
      }
    }

    // Discussion draft path: stashed before the OAuth round-trip when the
    // reader submitted the feedback dialog without the discussion scope.
    if (!deps.draft) {
      return { kind: "expired" };
    }
    try {
      const draft = await userinputApi.consumeFeedbackDraft({
        data: { draftId: deps.draft },
      });
      if (!draft) {
        return { kind: "expired" };
      }
      const result = await userinputApi.createUserinputDiscussion({
        data: {
          title: draft.title,
          ...(draft.body ? { body: draft.body } : {}),
          tag: draft.tag as "bug" | "feature" | "question",
        },
      });
      return { kind: "success", uri: result.uri };
    } catch (error) {
      return {
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while submitting your feedback.",
      };
    }
  },
  head: () => ({
    meta: [{ title: "Thanks for your feedback · Standard Reader" }],
  }),
  component: FeedbackReturnPage,
});

const styles = stylex.create({
  page: {
    alignItems: "center",
    backgroundColor: uiColor.bg,
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    paddingBottom: verticalSpace["5xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["5xl"],
  },
  panel: {
    boxSizing: "border-box",
    maxWidth: "32rem",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
    width: {
      default: "100%",
      [breakpoints.sm]: "min(100%, 32rem)",
    },
  },
  title: {
    color: uiColor.text1,
    fontFamily: fontFamily.serif,
    fontSize: fontSize["4xl"],
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.tight,
    marginBottom: 0,
    marginTop: 0,
  },
  body: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: 1.5,
  },
});

function FeedbackReturnPage() {
  const outcome = Route.useLoaderData();

  if (outcome.kind === "success") {
    return (
      <main {...stylex.props(styles.page)}>
        <Flex direction="column" style={styles.panel}>
          <Flex direction="column" gap="xxs">
            <h1 {...stylex.props(styles.title)}>Thank you.</h1>
            <p {...stylex.props(styles.body)}>
              Your feedback has been posted to{" "}
              <Link
                href={`https://userinput.app/#/d/${encodeURIComponent(outcome.uri)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                userinput.app
              </Link>
              . Thanks for helping us improve Standard Reader.
            </p>
          </Flex>
          <Flex>
            <Button
              variant="primary"
              onPress={() => (globalThis.location.href = "/feedback")}
            >
              View feedback
            </Button>
          </Flex>
        </Flex>
      </main>
    );
  }

  if (outcome.kind === "upvoted") {
    return (
      <main {...stylex.props(styles.page)}>
        <Flex direction="column" style={styles.panel}>
          <Flex direction="column" gap="xxs">
            <h1 {...stylex.props(styles.title)}>Upvoted.</h1>
            <p {...stylex.props(styles.body)}>
              Your upvote has been recorded on userinput.app. Thanks for helping
              surface what matters.
            </p>
          </Flex>
          <Flex>
            <Button
              variant="primary"
              onPress={() => (globalThis.location.href = "/feedback")}
            >
              View feedback
            </Button>
          </Flex>
        </Flex>
      </main>
    );
  }

  if (outcome.kind === "expired") {
    return (
      <main {...stylex.props(styles.page)}>
        <Flex direction="column" style={styles.panel}>
          <Flex direction="column" gap="xxs">
            <h1 {...stylex.props(styles.title)}>That link expired.</h1>
            <p {...stylex.props(styles.body)}>
              The feedback draft wasn't found — it may have expired (drafts last
              15 minutes) or you may have already submitted it. Try again any
              time.
            </p>
          </Flex>
          <Flex>
            <Button
              variant="primary"
              onPress={() => (globalThis.location.href = "/feedback")}
            >
              Back to feedback
            </Button>
          </Flex>
        </Flex>
      </main>
    );
  }

  return (
    <main {...stylex.props(styles.page)}>
      <Flex direction="column" style={styles.panel}>
        <Flex direction="column" gap="xxs">
          <h1 {...stylex.props(styles.title)}>Something went wrong.</h1>
          <p {...stylex.props(styles.body)}>{outcome.message}</p>
        </Flex>
        <Flex>
          <Button
            variant="primary"
            onPress={() => (globalThis.location.href = "/feedback")}
          >
            Back to feedback
          </Button>
        </Flex>
      </Flex>
    </main>
  );
}
