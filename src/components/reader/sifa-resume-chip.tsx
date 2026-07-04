import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge } from "#/design-system/badge";
import { authorApi } from "#/integrations/tanstack-query/api-author.functions";

const styles = stylex.create({
  link: {
    textDecoration: "none",
    color: "inherit",
  },
  placeholder: {
    flexShrink: 0,
    visibility: "hidden",
  },
});

export function SifaResumeChip({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...stylex.props(styles.link)}
    >
      <Badge size="sm" variant="default">
        Resume
      </Badge>
    </a>
  );
}

/** Invisible badge matching {@link SifaResumeChip} dimensions — reserves space while loading. */
function SifaResumeChipPlaceholder() {
  return (
    <Badge size="sm" variant="default" aria-hidden style={styles.placeholder}>
      Resume
    </Badge>
  );
}

export function AuthorSifaResumeChip({
  did,
  handle,
}: {
  did: string;
  handle: string | null;
}) {
  // The query result (chip, placeholder, or nothing) can legitimately differ
  // between the server render and the client's first pass — the loader's
  // prefetch for this is fire-and-forget, so whether it's settled by the time
  // the response is sent is timing-dependent. Gating on mount keeps the
  // hydration pass itself branch-free (always renders nothing), and only
  // resolves the real state in a client-only render right after.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: sifaProfileUrl, isPending } = useQuery({
    ...authorApi.getAuthorSifaProfileQueryOptions(did, handle),
    enabled: mounted,
  });

  if (!mounted) return null;
  if (sifaProfileUrl) {
    return <SifaResumeChip href={sifaProfileUrl} />;
  }
  if (isPending) {
    return <SifaResumeChipPlaceholder />;
  }
  return null;
}
