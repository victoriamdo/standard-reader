import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Pressable } from "react-aria";

import { user } from "#/integrations/tanstack-query/api-user.functions";
import { useOpenLinks } from "#/lib/use-open-links";
import { useTrackReadingHistory } from "#/lib/use-track-reading-history";

import { Flex } from "../../design-system/flex";
import { Separator } from "../../design-system/separator";
import { Switch } from "../../design-system/switch";
import { primaryColor, uiColor } from "../../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../../design-system/theme/semantic-spacing.stylex";
import { spacing } from "../../design-system/theme/spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../../design-system/theme/typography.stylex";
import { Tooltip } from "../../design-system/tooltip";

const MOBILE = "@media (max-width: 47.5rem)";

const styles = stylex.create({
  sectionHeading: {
    color: primaryColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.widest,
    marginBottom: verticalSpace.md,
    textTransform: "uppercase",
  },
  group: {
    borderColor: uiColor.border1,
    borderRadius: spacing["2"],
    borderStyle: "solid",
    borderWidth: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  row: {
    alignItems: {
      [MOBILE]: "stretch",
      default: "center",
    },
    columnGap: gap["3xl"],
    display: "flex",
    flexDirection: {
      [MOBILE]: "column",
      default: "row",
    },
    justifyContent: "space-between",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    rowGap: gap.lg,
  },
  label: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.sm,
    marginBottom: verticalSpace.xs,
    marginTop: 0,
  },
  description: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.sm,
    marginBottom: 0,
    marginTop: 0,
    maxWidth: "42ch",
  },
  control: {
    flexShrink: 0,
    width: { [MOBILE]: "100%", default: "auto" },
  },
});

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div {...stylex.props(styles.row)}>
      <div>
        <p {...stylex.props(styles.label)}>{label}</p>
        {description ? (
          <p {...stylex.props(styles.description)}>{description}</p>
        ) : null}
      </div>
      <div {...stylex.props(styles.control)}>{children}</div>
    </div>
  );
}

export function StepSettings() {
  const { openExternally, setOpenExternally } = useOpenLinks();
  const { enabled: trackReading, setEnabled: setTrackReading } =
    useTrackReadingHistory();

  const digestStatusQuery = useQuery(user.getWeeklyDigestStatusQueryOptions);
  const digestEnabled = Boolean(
    digestStatusQuery.data?.enabled && digestStatusQuery.data?.hasEmailScope,
  );

  return (
    <Flex direction="column" gap="6xl">
      <div>
        <h2 {...stylex.props(styles.sectionHeading)}>Reading &amp; privacy</h2>
        <div {...stylex.props(styles.group)}>
          <Row
            label="Keep reading history"
            description="Marks what you've read for unread counts. Written as public records on your AT Protocol account — turn off to read privately."
          >
            <Switch
              isSelected={trackReading}
              onChange={setTrackReading}
              aria-label="Keep reading history"
            />
          </Row>
          <Separator />
          <Row
            label="Open posts on their original site"
            description="When on, links open on the original website instead of the in-app reader."
          >
            <Switch
              isSelected={openExternally}
              onChange={setOpenExternally}
              aria-label="Open posts on their original site"
            />
          </Row>
        </div>
      </div>

      <div>
        <h2 {...stylex.props(styles.sectionHeading)}>Weekly digest</h2>
        <div {...stylex.props(styles.group)}>
          <Row
            label="Weekly digest email"
            description="A weekly email with the best of what you subscribe to, plus a couple of publications worth discovering."
          >
            <Tooltip text="Coming soon">
              <Pressable>
                <div {...stylex.props(styles.control)}>
                  <Switch
                    isSelected={digestEnabled}
                    isDisabled
                    aria-label="Weekly digest email"
                  />
                </div>
              </Pressable>
            </Tooltip>
          </Row>
        </div>
      </div>
    </Flex>
  );
}
