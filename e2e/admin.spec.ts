import { expect, test } from "./fixtures";
import { E2E_PASSWORD, joinAsGuest } from "./helpers";

const keep = (p: import("@playwright/test").Page) => p.getByRole("region", { name: "Keep" }).getByRole("listitem");

// The 5-attempt lockout is covered by convex/admin.test.ts; here it would block the cleanup.
test("admin: auto-login, re-login, agenda times, delete any idea, delete retro live", async ({ page, browser, newRetro }) => {
  const name = `E2E admin ${Date.now()}`;
  const url = await newRetro(page, { name });
  const guest = await joinAsGuest(browser, url);

  await page.getByLabel("New idea for Keep").fill("Creator idea");
  await page.getByLabel("New idea for Keep").press("Enter");
  await guest.getByLabel("New idea for Keep").fill("Guest idea");
  await guest.getByLabel("New idea for Keep").press("Enter");

  // The guest may delete only their own idea; the creator (auto-logged-in admin) may delete both.
  await expect(keep(guest).filter({ hasText: "Creator idea" }).getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await expect(keep(page).filter({ hasText: "Guest idea" }).getByRole("button", { name: "Delete" })).toBeVisible();

  // The creator lands in the admin panel without a password; after logging out it is needed.
  await page.getByRole("link", { name: "Open admin area" }).click();
  await expect(page.getByText("Agenda times", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /^Wrong password\.$/ })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Agenda times", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("spinbutton", { name: "Discuss & Act" }).fill("15");
  await expect(page.getByText("32 min of 30 min")).toBeVisible();
  await page.getByRole("button", { name: "Save times" }).click();
  await expect(guest.getByRole("list", { name: "Phases" })).toContainText("15 min");

  // Back on the board the admin deletes the guest's idea.
  await page.getByRole("link", { name: "← Back to retro" }).click();
  await keep(page).filter({ hasText: "Guest idea" }).getByRole("button", { name: "Delete" }).click();
  await keep(page).filter({ hasText: "Guest idea" }).getByRole("button", { name: "Yes, delete" }).click();
  await expect(guest.getByText("Guest idea")).toHaveCount(0);

  // Deleting the retro removes it for the guest in real time.
  await page.goto(`${url}/admin`);
  await page.getByLabel("Retro name to confirm").fill(name);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(guest.getByText("Retro not found")).toBeVisible();

  await guest.context().close();
});
