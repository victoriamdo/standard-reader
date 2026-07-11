import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { readerApi } from "#/integrations/tanstack-query/api-reader.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";

import { Button } from "../../design-system/button";
import { Flex } from "../../design-system/flex";
import {
  primaryColor,
  successColor,
  uiColor,
} from "../../design-system/theme/color.stylex";
import { breakpoints } from "../../design-system/theme/media-queries.stylex";
import { radius } from "../../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../../design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "../../design-system/theme/typography.stylex";
import { toasts } from "../../design-system/toast";
import { Body } from "../../design-system/typography";
import { Text } from "../../design-system/typography/text";
import { BrandWordmark } from "../reader/brand-wordmark";
import { StepFollow } from "./step-follow";
import { StepIntro } from "./step-intro";
import { StepSettings } from "./step-settings";
import { StepTopics } from "./step-topics";

export type OnboardingStep =
  | "intro"
  | "topics"
  | "follow"
  | "settings"
  | "done";

/** Ordered steps that count toward the progress dots (intro excluded). */
const PROGRESS_STEPS: Array<OnboardingStep> = [
  "topics",
  "follow",
  "settings",
  "done",
];

const MIN_FOLLOWS = 3;

type SessionData = Awaited<ReturnType<typeof user.getSession>>;

const styles = stylex.create({
  center: {
    textAlign: "center",
  },
  // Keep the Skip button's box on the final step (invisible) so the header
  // height stays constant and the wordmark doesn't shift between steps.
  skipHidden: {
    visibility: "hidden",
  },
  main: {
    backgroundColor: primaryColor.bgSubtle,
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    position: "relative",
  },
  header: {
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    justifyContent: "space-between",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  scroll: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    overflowY: "auto",
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
  },
  column: {
    // `marginBlock: auto` centers the step vertically when it's shorter than
    // the viewport, and collapses to allow normal scrolling when it's taller.
    marginBottom: "auto",
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: "auto",
    paddingBottom: verticalSpace["5xl"],
    paddingTop: verticalSpace["5xl"],
    width: {
      default: "100%",
      [breakpoints.sm]: "min(92vw, 560px)",
    },
  },
  stepHeading: {
    display: "flex",
    flexDirection: "column",
    marginBottom: verticalSpace["5xl"],
    rowGap: verticalSpace["2xl"],
    textAlign: "center",
  },
  footer: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace.xl,
    rowGap: verticalSpace.lg,
    width: {
      default: "100%",
      [breakpoints.sm]: "min(92vw, 560px)",
    },
  },
  footerRow: {
    alignItems: "center",
    columnGap: gap.xl,
    display: "flex",
    justifyContent: "space-between",
  },
  counter: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  counterReady: {
    color: successColor.text2,
    fontWeight: fontWeight.medium,
  },
  dotsBar: {
    alignItems: "center",
    columnGap: gap.sm,
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    paddingBottom: `calc(${verticalSpace["3xl"]} + env(safe-area-inset-bottom))`,
    paddingTop: verticalSpace["3xl"],
  },
  dot: {
    backgroundColor: uiColor.border2,
    borderRadius: radius.full,
    height: 7,
    width: 7,
  },
  dotActive: {
    backgroundColor: primaryColor.solid1,
    width: 20,
  },
  dotDone: {
    backgroundColor: primaryColor.border3,
  },
});

const STEP_COPY: Record<
  Exclude<OnboardingStep, "intro" | "done">,
  { title: string; dek: string }
> = {
  topics: {
    title: "What do you like to read?",
    dek: "Pick a few topics — we'll suggest publications to match. Optional.",
  },
  follow: {
    title: "Follow a few publications",
    dek: "Your Home feed is built from follows. Three is a good start.",
  },
  settings: {
    title: "A few preferences",
    dek: "Set these now, or change them any time in Settings.",
  },
};

export function WelcomeWizard({
  step,
  topics,
  onStepChange,
  onTopicsChange,
}: {
  step: OnboardingStep;
  topics: Array<string>;
  onStepChange: (next: OnboardingStep) => void;
  onTopicsChange: (next: Array<string>) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const finishMutation = useMutation({
    mutationFn: async () => user.setOnboardingCompleted(),
    onSuccess: () => {
      // Patch the session cache in place so the Home gate sees completion
      // without a full session refetch (which re-restores the PDS client).
      queryClient.setQueryData<SessionData>(
        user.getSessionQueryOptions.queryKey,
        (prev) => (prev ? { ...prev, onboardingCompleted: true } : prev),
      );
      // Surface the new follows in the sidebar + populate Home.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "feed",
      });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (uris: Array<string>) =>
      readerApi.followPublications({ data: { publicationUris: uris } }),
  });

  const toggleFollow = useCallback((uri: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(uri);
      else copy.delete(uri);
      return copy;
    });
  }, []);

  // Follows are committed once, at the end. Keeping them as in-memory selection
  // until then means back/forward preserves the picks (and the suggestion list
  // doesn't drop rows as "already followed" mid-wizard).
  const finishAndGoHome = useCallback(async () => {
    const uris = [...selected];
    if (uris.length > 0) {
      try {
        const { results } = await followMutation.mutateAsync(uris);
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          toasts.add(
            {
              variant: "warning",
              title: `Couldn't follow ${failed.length} publication${
                failed.length === 1 ? "" : "s"
              }`,
              description: "You can add them later from Discover.",
            },
            { timeout: 5000 },
          );
        }
      } catch {
        toasts.add(
          {
            variant: "critical",
            title: "Couldn't save your follows",
            description: "You can follow publications from Discover.",
          },
          { timeout: 5000 },
        );
      }
    }
    await finishMutation.mutateAsync();
    await navigate({ to: "/" });
  }, [selected, followMutation, finishMutation, navigate]);

  const progressIndex = PROGRESS_STEPS.indexOf(step);

  // Reset the scroll position whenever the step changes so each step starts at
  // the top rather than inheriting the previous step's scroll offset.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const backTarget: Record<OnboardingStep, OnboardingStep | null> = {
    intro: null,
    topics: "intro",
    follow: "topics",
    settings: "follow",
    done: "settings",
  };

  const forward = () => {
    switch (step) {
      case "intro": {
        onStepChange("topics");
        break;
      }
      case "topics": {
        onStepChange("follow");
        break;
      }
      case "follow": {
        onStepChange("settings");
        break;
      }
      case "settings": {
        onStepChange("done");
        break;
      }
      case "done": {
        void finishAndGoHome();
        break;
      }
    }
  };

  const forwardLabel =
    step === "intro"
      ? "Get started"
      : step === "topics"
        ? "Continue"
        : step === "follow"
          ? selected.size === 0
            ? "Skip for now"
            : "Continue"
          : step === "settings"
            ? "Finish"
            : "Start reading";

  const forwardPending =
    step === "done" && (followMutation.isPending || finishMutation.isPending);

  const back = backTarget[step];

  return (
    <main {...stylex.props(styles.main)}>
      <div {...stylex.props(styles.header)}>
        <BrandWordmark />
        <Button
          variant="tertiary"
          size="sm"
          onPress={() => void finishAndGoHome()}
          isDisabled={
            step === "done" ||
            finishMutation.isPending ||
            followMutation.isPending
          }
          style={step === "done" ? styles.skipHidden : undefined}
        >
          Skip for now
        </Button>
      </div>

      <div ref={scrollRef} {...stylex.props(styles.scroll)}>
        <div {...stylex.props(styles.column)}>
          {step === "intro" ? <StepIntro /> : null}

          {step === "topics" ? (
            <>
              <StepHeadingBlock stepKey="topics" />
              <StepTopics selected={topics} onChange={onTopicsChange} />
            </>
          ) : null}

          {step === "follow" ? (
            <>
              <StepHeadingBlock stepKey="follow" />
              <StepFollow
                topics={topics}
                selected={selected}
                onToggle={toggleFollow}
              />
            </>
          ) : null}

          {step === "settings" ? (
            <>
              <StepHeadingBlock stepKey="settings" />
              <StepSettings />
            </>
          ) : null}

          {step === "done" ? (
            <Flex direction="column" align="center" gap="5xl">
              <Text font="title" size="3xl" weight="bold">
                Your feed is ready
              </Text>
              <Body variant="secondary" style={styles.center}>
                {selected.size > 0
                  ? `You're following ${selected.size} publication${
                      selected.size === 1 ? "" : "s"
                    }. Their latest writing will collect on Home.`
                  : "Your Home feed is empty for now — head to Discover whenever you're ready, and everything you follow will start collecting here."}
              </Body>
            </Flex>
          ) : null}
        </div>
      </div>

      <div {...stylex.props(styles.footer)}>
        {step === "follow" ? (
          <span
            {...stylex.props(
              styles.counter,
              selected.size >= MIN_FOLLOWS && styles.counterReady,
            )}
          >
            {selected.size === 0
              ? `Follow at least ${MIN_FOLLOWS} to fill your feed`
              : `${selected.size} selected${
                  selected.size < MIN_FOLLOWS
                    ? ` — ${MIN_FOLLOWS - selected.size} more to fill your feed`
                    : ""
                }`}
          </span>
        ) : null}
        <div {...stylex.props(styles.footerRow)}>
          <Button
            variant="tertiary"
            isDisabled={back == null}
            onPress={() => back && onStepChange(back)}
          >
            Back
          </Button>
          <Button
            variant={
              step === "follow" && selected.size === 0 ? "outline" : "primary"
            }
            isPending={forwardPending}
            onPress={forward}
          >
            {forwardLabel}
          </Button>
        </div>
      </div>

      <div {...stylex.props(styles.dotsBar)} aria-hidden>
        {PROGRESS_STEPS.map((s, i) => (
          <span
            key={s}
            {...stylex.props(
              styles.dot,
              progressIndex === i && styles.dotActive,
              progressIndex > i && styles.dotDone,
            )}
          />
        ))}
      </div>
    </main>
  );
}

function StepHeadingBlock({
  stepKey,
}: {
  stepKey: Exclude<OnboardingStep, "intro" | "done">;
}) {
  const copy = STEP_COPY[stepKey];
  return (
    <div {...stylex.props(styles.stepHeading)}>
      <Text font="title" size="3xl" weight="bold">
        {copy.title}
      </Text>
      <Body variant="secondary">{copy.dek}</Body>
    </div>
  );
}
