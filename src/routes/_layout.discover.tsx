import { createFileRoute } from "@tanstack/react-router";

import { Masthead, ReaderContent } from "../components/reader/primitives";
import { Body } from "../design-system/typography";

export const Route = createFileRoute("/_layout/discover")({
  component: Discover,
});

function Discover() {
  return (
    <ReaderContent>
      <Masthead
        kicker="The directory"
        title="Discover"
        dek="Every publication the network knows about — follow the ones worth your mornings."
      />
      <Body>
        The directory (recommended, trending, and the full browsable list) lands
        here next.
      </Body>
    </ReaderContent>
  );
}
