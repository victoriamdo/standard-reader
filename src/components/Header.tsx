import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

import { Flex } from "../design-system/flex";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { Text } from "../design-system/typography/text";
import ThemeToggle from "./ThemeToggle";

const styles = stylex.create({
  header: {
    backgroundColor: uiColor.bgSubtle,
    position: "sticky",
    zIndex: 50,
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    top: 0,
  },
  nav: {
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
    width: "min(1080px, 100%)",
  },
  brand: {
    textDecoration: "none",
    color: uiColor.text2,
    fontWeight: fontWeight.bold,
  },
  link: {
    textDecoration: "none",
    color: {
      default: uiColor.text1,
      ":is([data-hovered])": uiColor.text2,
    },
  },
  linkActive: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  pushRight: {
    marginLeft: "auto",
  },
});

export default function Header() {
  return (
    <header {...stylex.props(styles.header)}>
      <Flex align="center" gap="4xl" style={styles.nav}>
        <Link to="/" {...stylex.props(styles.brand)}>
          <Text font="title" size="lg" weight="bold">
            TanStack Start
          </Text>
        </Link>

        <Flex align="center" gap="2xl">
          <Link
            to="/"
            {...stylex.props(styles.link)}
            activeProps={stylex.props(styles.link, styles.linkActive)}
          >
            Home
          </Link>
          <Link
            to="/about"
            {...stylex.props(styles.link)}
            activeProps={stylex.props(styles.link, styles.linkActive)}
          >
            About
          </Link>
        </Flex>

        <Flex align="center" gap="xl" style={styles.pushRight}>
          <ThemeToggle />
        </Flex>
      </Flex>
    </header>
  );
}
