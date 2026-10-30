import { expect, test } from "@playwright/test";

test("home page loads with version", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^v\d+\.\d+$/)).toBeVisible();
  await expect(page.getByText(/No retros on this device yet|Your recent retros/).first()).toBeVisible();
});
