import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const authState = JSON.parse(readFileSync("./perf/.auth-state.json", "utf8"));
const COOKIE_NAME = "standard-reader-auth.session_token";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies([
  { name: COOKIE_NAME, value: authState.sessionToken, domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
  { name: COOKIE_NAME, value: authState.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
]);

const page = await context.newPage();
await page.goto(
  "http://localhost:3000/labelers/did:web:botlabeler.standard-reader.app?view=documents",
  { waitUntil: "networkidle", timeout: 30000 },
);
await page.waitForTimeout(1000);
const text = await page.locator("body").innerText();
const match = text.match(/(\d+)\s*\n?\s*documents/);
console.log("documents stat match:", match?.[0]);
await page.screenshot({ path: "check-3000.png" });
await browser.close();
