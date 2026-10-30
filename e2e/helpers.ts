import { expect, type Browser, type Page } from "@playwright/test";

export const E2E_PASSWORD = "e2e-secret";

/** Creates a retro through the UI and returns its URL. Names start with "E2E" for cleanup. */
export async function createRetro(
  page: Page,
  opts: { name?: string; length?: 30 | 45 | 60 | 90; disable?: string[] } = {},
): Promise<string> {
  const name = opts.name ?? `E2E ${Date.now()}`;
  await page.goto("/new");
  await page.getByLabel("Name *").fill(name);
  await page.getByLabel("Facilitator *").fill("Playwright");
  if (opts.length) await page.getByRole("button", { name: `${opts.length} min` }).click();
  for (const phase of opts.disable ?? []) await page.getByLabel(phase).uncheck();
  await page.getByLabel(/Admin password/).fill(E2E_PASSWORD);
  await page.getByLabel("Repeat password *").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create retro" }).click();
  // Creating hashes the password in a Convex Node action, which can cold-start for a few seconds.
  await expect(page).toHaveURL(/\/r\/[a-z0-9]{8}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url();
}

/** Opens the retro as another participant in a fresh browser context (own localStorage). */
export async function joinAsGuest(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page;
}

/** Parses "06:25" / "+01:23" from the phase timer into seconds (negative = overtime). */
export async function timerSeconds(page: Page): Promise<number> {
  const text = (await page.getByRole("timer").locator("span").last().textContent()) ?? "";
  const m = text.match(/^(\+)?(\d+):(\d{2})$/);
  if (!m) throw new Error(`Timer shows "${text}"`);
  const sec = Number(m[2]) * 60 + Number(m[3]);
  return m[1] ? -sec : sec;
}

/** Logs in to the retro's admin area and deletes it; no-op if it is already gone. */
export async function deleteRetro(page: Page, url: string, name: string, password = E2E_PASSWORD): Promise<void> {
  await page.goto(`${url}/admin`);
  const login = page.getByLabel("Password", { exact: true });
  const missing = page.getByText("Retro not found");
  await expect(login.or(missing)).toBeVisible();
  if (await missing.isVisible()) return;
  await login.fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByLabel("Retro name to confirm")).toBeVisible({ timeout: 30_000 }); // Node action, see above
  await page.getByLabel("Retro name to confirm").fill(name);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  // The page either redirects home or shows "not found" as soon as the deletion is live.
  await expect(page.getByRole("heading", { name: "Run a retro in minutes." }).or(missing).first()).toBeVisible({
    timeout: 15_000,
  });
}
