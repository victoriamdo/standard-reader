import { loadPerfFixtures } from "./fixtures.ts";
import {
  perfBaseUrl,
  perfBudgetMultiplier,
  perfDefaultTimeoutMs,
} from "./config.ts";

export type PerfAuthMode = "guest" | "signed-in";

export interface PerfTarget {
  /** Stable id for reports (e.g. `home`, `tag.feed`). */
  id: string;
  /** Human label in failure output. */
  name: string;
  /** Path + query (no origin). */
  path: string;
  auth: PerfAuthMode;
  /** Max wall-clock ms until the view is ready. */
  budgetMs: number;
  timeoutMs: number;
  /** When false, skip instead of fail if fixture env is missing. */
  required?: boolean;
}

function scaleBudget(ms: number): number {
  return Math.round(ms * perfBudgetMultiplier());
}

function target(
  partial: Omit<PerfTarget, "timeoutMs"> & { timeoutMs?: number },
): PerfTarget {
  return {
    timeoutMs: partial.timeoutMs ?? perfDefaultTimeoutMs(),
    required: partial.required ?? true,
    ...partial,
    budgetMs: scaleBudget(partial.budgetMs),
  };
}

/** Guest-visible routes — always run in CI. */
export function guestTargets(): Array<PerfTarget> {
  const fixtures = loadPerfFixtures();
  const base = perfBaseUrl();

  void base;

  const targets: Array<PerfTarget> = [
    target({
      id: "home",
      name: "Home",
      path: "/",
      auth: "guest",
      budgetMs: 3500,
    }),
    target({
      id: "latest.subscriptions",
      name: "Latest (subscriptions)",
      path: "/latest",
      auth: "guest",
      budgetMs: 4000,
    }),
    target({
      id: "latest.trending",
      name: "Latest (trending)",
      path: "/latest?filter=trending",
      auth: "guest",
      budgetMs: 4500,
    }),
    target({
      id: "discover",
      name: "Discover",
      path: "/discover",
      auth: "guest",
      budgetMs: 5000,
    }),
    target({
      id: "search",
      name: "Search",
      path: `/search?q=${encodeURIComponent(fixtures.searchQuery)}`,
      auth: "guest",
      budgetMs: 4000,
    }),
    target({
      id: "about",
      name: "About",
      path: "/about",
      auth: "guest",
      budgetMs: 2500,
    }),
    target({
      id: "tag.feed",
      name: `Tag feed (${fixtures.tag})`,
      path: `/tag/${encodeURIComponent(fixtures.tag)}`,
      auth: "guest",
      budgetMs: 5500,
    }),
    target({
      id: "tag.publications",
      name: `Tag publications (${fixtures.tag})`,
      path: `/tag/${encodeURIComponent(fixtures.tag)}?view=publications`,
      auth: "guest",
      budgetMs: 5500,
    }),
  ];

  if (fixtures.publicationPath) {
    targets.push(
      target({
        id: "publication",
        name: "Publication profile",
        path: fixtures.publicationPath,
        auth: "guest",
        budgetMs: 3500,
        required: false,
      }),
    );
  }

  if (fixtures.articlePath) {
    targets.push(
      target({
        id: "article",
        name: "Article",
        path: fixtures.articlePath,
        auth: "guest",
        budgetMs: 4500,
        required: false,
      }),
    );
  }

  return targets;
}

/** Signed-in routes — skipped when PERF_TEST_SESSION_TOKEN is unset. */
export function signedInTargets(): Array<PerfTarget> {
  const fixtures = loadPerfFixtures();

  const targets: Array<PerfTarget> = [
    target({
      id: "home.signed-in",
      name: "Home (signed in)",
      path: "/",
      auth: "signed-in",
      budgetMs: 4500,
    }),
    target({
      id: "latest.signed-in",
      name: "Latest (signed in)",
      path: "/latest",
      auth: "signed-in",
      budgetMs: 4500,
    }),
    target({
      id: "saved",
      name: "Saved for later",
      path: "/saved",
      auth: "signed-in",
      budgetMs: 5000,
    }),
    target({
      id: "history",
      name: "Reading history",
      path: "/history",
      auth: "signed-in",
      budgetMs: 5000,
    }),
    target({
      id: "likes",
      name: "Likes",
      path: "/likes",
      auth: "signed-in",
      budgetMs: 5000,
    }),
  ];

  if (fixtures.articlePath) {
    targets.push(
      target({
        id: "article.signed-in",
        name: "Article (signed in)",
        path: fixtures.articlePath,
        auth: "signed-in",
        budgetMs: 4500,
        required: false,
      }),
    );
  }

  return targets;
}

export function allTargets(): Array<PerfTarget> {
  return [...guestTargets(), ...signedInTargets()];
}

export function targetUrl(target: PerfTarget): string {
  return `${perfBaseUrl()}${target.path}`;
}
