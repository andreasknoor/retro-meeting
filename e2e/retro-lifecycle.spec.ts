import { expect, test } from "@playwright/test";
import { deleteRetro } from "./helpers";

// Creates real retros. In production they are prefixed "E2E" so they can be cleaned up (see helpers.ts).
test("create a retro, open it via link and find it under recent retros", async ({ page, context }) => {
  const name = `E2E ${Date.now()}`;
  await page.goto("/new");
  await page.getByLabel("Name *").fill(name);
  await page.getByLabel("Goal / subtitle").fill("Created by Playwright");
  await page.getByLabel("Facilitator *").fill("Playwright");
  await page.getByRole("button", { name: "45 min" }).click();
  await page.getByLabel("Vote").uncheck();
  await expect(page.getByRole("list", { name: "Agenda preview" })).not.toContainText("Vote");
  await page.getByLabel(/Admin password/).fill("e2e-secret");
  await page.getByLabel("Repeat password *").fill("e2e-secre");
  await expect(page.getByRole("img", { name: "Passwords match" })).toHaveCount(0);
  await page.getByLabel("Repeat password *").pressSequentially("t");
  await expect(page.getByRole("img", { name: "Passwords match" })).toBeVisible();
  await page.getByRole("button", { name: "Create retro" }).click();

  await expect(page).toHaveURL(/\/r\/[a-z0-9]{8}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Created by Playwright")).toBeVisible();
  await expect(page.getByText("45 minutes")).toBeVisible();
  const url = page.url();

  // A second participant opens the link in a fresh browser context.
  const other = await context.browser()!.newContext();
  const guest = await other.newPage();
  await guest.goto(url);
  await expect(guest.getByRole("heading", { level: 1, name })).toBeVisible();
  await other.close();

  // Back on the home page, the creator sees it under recent retros and can paste the link.
  await page.goto("/");
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await page.getByLabel("Have a link?").fill(url);
  await page.getByLabel("Have a link?").press("Enter");
  await expect(page).toHaveURL(url);

  await deleteRetro(page, url, name);
});

test("shows validation errors for an empty form", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "Create retro" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Name is required." })).toBeVisible();
});

test("unknown retro shows not found", async ({ page }) => {
  await page.goto("/r/zzzzzzzz");
  await expect(page.getByText("Retro not found")).toBeVisible();
});
