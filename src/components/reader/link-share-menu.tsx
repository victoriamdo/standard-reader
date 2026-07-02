"use client";

import { Menu, MenuItem, MenuSeparator, SubMenu } from "#/design-system/menu";
import { shareLinkUrl, useNativeShareAvailable } from "#/lib/native-share";
import {
  AT_PROTO_COMPOSE_CLIENTS,
  buildAtprotoComposeUrl,
  buildBlueskyComposeUrl,
  buildDisperseShareUrl,
} from "#/lib/quote-share";

function openExternal(url: string) {
  globalThis.open(url, "_blank", "noopener,noreferrer");
}

export function LinkShareMenu({
  getLinkUrl,
  ensureLinkUrl,
  trigger,
  onShare,
  isOpen,
  onOpenChange,
  children,
}: {
  getLinkUrl: () => string | null;
  /** Lazily create the link URL on demand when a share action is taken. */
  ensureLinkUrl?: () => Promise<string | null>;
  trigger: React.ReactNode;
  onShare?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const nativeShareAvailable = useNativeShareAvailable();
  const resolveLinkUrl = () => getLinkUrl();

  // When ensureLinkUrl is provided, items are always enabled — the URL is
  // created on press, not beforehand. Otherwise items disable until a URL is
  // available.
  const canShare = Boolean(ensureLinkUrl) || Boolean(resolveLinkUrl());

  const openShareUrl = async (buildUrl: (linkUrl: string) => string) => {
    const linkUrl = ensureLinkUrl ? await ensureLinkUrl() : resolveLinkUrl();
    if (!linkUrl) return;
    openExternal(buildUrl(linkUrl));
    onShare?.();
  };

  return (
    <Menu trigger={trigger} isOpen={isOpen} onOpenChange={onOpenChange}>
      <MenuItem
        isDisabled={!canShare}
        onPress={() => {
          void openShareUrl(buildBlueskyComposeUrl);
        }}
      >
        Share to Bluesky
      </MenuItem>
      <SubMenu
        trigger={
          <MenuItem isDisabled={!canShare}>Share to Alternate Client</MenuItem>
        }
      >
        {AT_PROTO_COMPOSE_CLIENTS.map((client) => (
          <MenuItem
            key={client.id}
            onPress={() => {
              void openShareUrl((linkUrl) =>
                buildAtprotoComposeUrl(client.origin, linkUrl),
              );
            }}
          >
            {client.label}
          </MenuItem>
        ))}
      </SubMenu>
      <MenuSeparator />
      <MenuItem
        isDisabled={!canShare}
        onPress={() => {
          void openShareUrl(buildDisperseShareUrl);
        }}
      >
        Send to Disperse
      </MenuItem>
      {nativeShareAvailable ? (
        <>
          <MenuSeparator />
          <MenuItem
            isDisabled={!canShare}
            onPress={() => {
              void (async () => {
                const linkUrl = ensureLinkUrl
                  ? await ensureLinkUrl()
                  : resolveLinkUrl();
                if (!linkUrl) return;
                const shared = await shareLinkUrl(linkUrl);
                if (shared) onShare?.();
              })();
            }}
          >
            Share elsewhere
          </MenuItem>
        </>
      ) : null}
      {children}
    </Menu>
  );
}
