import * as stylex from "@stylexjs/stylex";

import { Flex } from "../design-system/flex";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Text } from "../design-system/typography/text";

const styles = stylex.create({
  footer: {
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
  },
  inner: {
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["6xl"],
    paddingTop: verticalSpace["6xl"],
    width: "min(1080px, 100%)",
  },
});

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer {...stylex.props(styles.footer)}>
      <Flex
        align="center"
        justify="between"
        gap="2xl"
        wrap
        style={styles.inner}
      >
        <Text size="sm" variant="secondary">
          © {year} Your name here.
        </Text>
        <Text size="sm" variant="secondary">
          Built with TanStack Start + hip-ui
        </Text>
      </Flex>
    </footer>
  );
}
