import { createFileRoute } from "@tanstack/react-router";

import { Masthead, ReaderContent } from "../components/reader/primitives";
import { Body } from "../design-system/typography";

export const Route = createFileRoute("/_layout/latest")({ component: Latest });

function Latest() {
  return (
    <ReaderContent>
      <Masthead
        kicker="From your follows"
        title="Latest"
        dek="Everything published recently across the publications you follow."
      />
      <Body>The chronological All / Unread feed lands here next.</Body>
    </ReaderContent>
  );
}
