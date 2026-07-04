import * as stylex from "@stylexjs/stylex";

import { MenuItem } from "#/design-system/menu";
import { uiColor } from "#/design-system/theme/color.stylex";
import { useOpenLinks } from "#/lib/use-open-links";

const styles = stylex.create({
  currentState: {
    color: uiColor.text1,
  },
});

/**
 * Toggle for the "open on original site" preference: when on, document links
 * open on the external website where they're published instead of the in-app
 * reader.
 */
export function OpenLinksMenuItem() {
  const { openExternally, setOpenExternally } = useOpenLinks();

  return (
    <MenuItem
      onPress={() => setOpenExternally(!openExternally)}
      suffix={
        <span {...stylex.props(styles.currentState)}>
          {openExternally ? "On" : "Off"}
        </span>
      }
    >
      Open posts externally
    </MenuItem>
  );
}
