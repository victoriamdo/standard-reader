/**
 * The labeler's self-description: the `bot` label value and how clients should
 * present it. Served from `app.standard-reader.labeler.getServices` (a did:web
 * labeler has no repo to hold the service record).
 */

import { config } from "./config.ts";

export function labelerServiceView() {
  return {
    did: config.labelerDid,
    displayName: "Bots",
    description:
      "Labels posts from accounts that have declared themselves bots (a `bot` self-label on their profile).",
    policies: {
      labelValues: [config.labelValue],
      labelValueDefinitions: [
        {
          identifier: config.labelValue,
          severity: "inform",
          blurs: "none",
          defaultSetting: "warn",
          adultOnly: false,
          locales: [
            {
              lang: "en",
              name: "Bot",
              description:
                "This post is from an account that has self-declared as a bot / automated account (a `bot` self-label on its app.bsky.actor.profile).",
            },
          ],
        },
      ],
    },
    indexedAt: new Date().toISOString(),
  };
}
