import type { Page } from "@playwright/test";

import type { PerfTarget } from "./targets.ts";
import { targetUrl } from "./targets.ts";

export interface LoadMeasurement {
  id: string;
  name: string;
  path: string;
  auth: PerfTarget["auth"];
  budgetMs: number;
  ms: number;
  url: string;
  status: number | null;
  overBudget: boolean;
}

async function waitForViewReady(page: Page, timeoutMs: number): Promise<void> {
  await page.locator("[data-app-scroller]").waitFor({
    state: "visible",
    timeout: timeoutMs,
  });

  await page.waitForFunction(
    () => {
      const scroller = document.querySelector("[data-app-scroller]");
      if (!scroller) return false;
      return scroller.querySelector("[aria-busy='true']") === null;
    },
    { timeout: timeoutMs },
  );
}

export async function measurePageLoad(
  page: Page,
  target: PerfTarget,
): Promise<LoadMeasurement> {
  const url = targetUrl(target);
  const started = performance.now();

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: target.timeoutMs,
  });

  await waitForViewReady(page, target.timeoutMs);

  const ms = Math.round(performance.now() - started);

  return {
    id: target.id,
    name: target.name,
    path: target.path,
    auth: target.auth,
    budgetMs: target.budgetMs,
    ms,
    url,
    status: response?.status() ?? null,
    overBudget: ms > target.budgetMs,
  };
}

export async function warmupTarget(
  page: Page,
  target: PerfTarget,
): Promise<void> {
  const url = targetUrl(target);
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: target.timeoutMs,
  });
  await waitForViewReady(page, target.timeoutMs);
}
