import { bskyEmbedMatches } from "../lib/manifest-hosts";
import { initBskyEmbedBookmarks } from "../lib/bsky-embed-bookmark";

export default defineContentScript({
  matches: bskyEmbedMatches(import.meta.env.DEV),
  runAt: "document_idle",
  async main() {
    await initBskyEmbedBookmarks();
  },
});
