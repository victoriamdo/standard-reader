"use client";

import * as stylex from "@stylexjs/stylex";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  tracking,
} from "../design-system/theme/typography.stylex";
import { atstoreReviewApi } from "../integrations/tanstack-query/api-atstore-review.functions";
import { sanitizeAuthRedirectTarget } from "../utils/auth-redirect";

const searchSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  text: z.string().max(8000).optional(),
  returnTo: z.string().optional(),
  loginSuccess: z.union([z.string(), z.boolean()]).optional(),
  handle: z.string().optional(),
  avatar: z.string().optional(),
});

export const Route = createFileRoute("/review/thanks")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, location }) => {
    if (deps.rating !== undefined) {
      const result = await atstoreReviewApi.completeReviewFromSearch({
        data: {
          rating: deps.rating,
          ...(deps.text ? { text: deps.text } : {}),
          returnTo: deps.returnTo,
        },
      });

      throw redirect({
        to: "/review/thanks",
        search: {
          returnTo: sanitizeAuthRedirectTarget(result.returnTo, location.href),
        },
      });
    }

    return {
      returnTo: sanitizeAuthRedirectTarget(deps.returnTo, location.href),
    };
  },
  head: () => ({
    meta: [{ title: "Thanks for your review · Standard Reader" }],
  }),
  component: ReviewThanksPage,
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

function ReviewThanksPage() {
  const { returnTo } = Route.useLoaderData();

  return (
    <main {...stylex.props(styles.page)}>
      <Flex direction="column" style={styles.panel}>
        <Flex direction="column" gap="xxs">
          <h1 {...stylex.props(styles.title)}>Thank you.</h1>
          <p {...stylex.props(styles.body)}>
            Your review has been posted to ATStore. Thanks for helping more
            readers discover Standard Reader.
          </p>
        </Flex>
        <Flex>
          <Button
            variant="primary"
            onPress={() => {
              globalThis.location.href = returnTo;
            }}
          >
            Return to the app
          </Button>
        </Flex>
      </Flex>
    </main>
  );
}
