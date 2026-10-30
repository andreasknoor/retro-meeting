import { expect, test } from "./fixtures";
import { E2E_PASSWORD, joinAsGuest } from "./helpers";

// The 5-attempt lockout is covered by convex/admin.test.ts; here it would block the cleanup.
test("admin: wrong password, agenda times, delete any idea, delete retro live", async ({ page, browser, newRetro }) => {
  const name = `E2E admin ${Date.now()}`;
  const url = await newRetro(page, { name });
  const guest = await joinAsGuest(browser, url);

  // A guest idea that only an admin may delete.
  await guest.getByLabel("New idea for Keep").fill("Guest idea");
  await guest.getByLabel("New idea for Keep").press("Enter");
  const guestIdea = page.getByRole("region", { name: "Keep" }).getByRole("listitem").filter({ hasText: "Guest idea" });
  await expect(guestIdea).toBeVisible();
  await expect(guestIdea.getByRole("button", { name: "Delete" })).toHaveCount(0);

  await page.getByRole("link", { name: "Open admin area" }).click();
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong password. 4 attempts left." })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Agenda times", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("spinbutton", { name: "Discuss" }).fill("15");
  await expect(page.getByText("32 min of 30 min")).toBeVisible();
  await page.getByRole("button", { name: "Save times" }).click();
  await expect(guest.getByRole("list", { name: "Phases" })).toContainText("15 min");

  // Back on the board the admin can delete the guest's idea.
  await page.getByRole("link", { name: "← Back to retro" }).click();
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  await guestIdea.getByRole("button", { name: "Delete" }).click();
  await expect(guest.getByText("Guest idea")).toHaveCount(0);

  // Deleting the retro removes it for the guest in real time.
  await page.goto(`${url}/admin`);
  await page.getByLabel("Retro name to confirm").fill(name);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(guest.getByText("Retro not found")).toBeVisible();

  await guest.context().close();
});
