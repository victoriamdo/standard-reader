import { createMiddleware } from "@tanstack/react-start";

export const dbMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const [
      { db },
      schema,
      { resolveTrackReadingHistoryEnabled },
      { resolveCountOldPostsAsUnreadEnabled },
    ] = await Promise.all([
      import("#/db/index.server"),
      import("#/db/schema"),
      import("#/server/reader/track-reading-history.server"),
      import("#/server/reader/count-old-posts-as-unread.server"),
    ]);

    const [trackReadingEnabled, countOldPostsAsUnreadEnabled] =
      await Promise.all([
        resolveTrackReadingHistoryEnabled(db, schema),
        resolveCountOldPostsAsUnreadEnabled(db, schema),
      ]);

    return next({
      context: {
        db,
        schema,
        trackReadingEnabled,
        countOldPostsAsUnreadEnabled,
      },
    });
  },
);
