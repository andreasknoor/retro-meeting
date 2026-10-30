import { expect, test } from "@playwright/test";

test("home page loads and reaches the backend", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Backend connected")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/^v\d+\.\d+$/)).toBeVisible();
});
