"use client";

import { Link as LinkIcon, Share2 } from "lucide-react";

import { Button } from "#/design-system/button";
import type { Size } from "#/design-system/theme/types";
import { IconButton } from "#/design-system/icon-button";
import { Menu, MenuItem } from "#/design-system/menu";
import { buildBlueskyComposeUrl } from "#/lib/quote-share";

export function ShareMenu({
  pageUrl,
  variant = "button",
  size = "md",
}: {
  pageUrl: string;
  variant?: "button" | "icon";
  size?: Size;
}) {
  const onCopyLink = () => {
    void navigator.clipboard.writeText(pageUrl);
  };

  const onShareBluesky = () => {
    globalThis.open(
      buildBlueskyComposeUrl(pageUrl),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const iconSize = size === "sm" ? 14 : 18;

  const trigger =
    variant === "icon" ? (
      <IconButton variant="secondary" size={size} label="Share">
        <Share2 size={iconSize} />
      </IconButton>
    ) : (
      <Button variant="secondary" size={size === "sm" ? "sm" : undefined}>
        <Share2 size={14} /> Share
      </Button>
    );

  return (
    <Menu trigger={trigger}>
      <MenuItem onPress={onCopyLink} suffix={<LinkIcon size={14} />}>
        Copy link
      </MenuItem>
      <MenuItem onPress={onShareBluesky} suffix={<Share2 size={14} />}>
        Share on Bluesky
      </MenuItem>
    </Menu>
  );
}
