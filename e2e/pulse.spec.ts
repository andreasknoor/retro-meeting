import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

test("pulse answers update live and changing an answer does not double-count", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const guest = await joinAsGuest(browser, url);

  await page.getByRole("button", { name: /^4\s*Good$/ }).click();
  await guest.getByRole("button", { name: /^2\s*Poor$/ }).click();

  for (const p of [page, guest]) {
    await expect(p.getByText("2 people have answered")).toBeVisible();
    await expect(p.getByText("3.0", { exact: true })).toBeVisible();
  }
  await expect(page.getByText("You answered 4")).toBeVisible();

  await guest.getByRole("button", { name: /^5\s*Great$/ }).click();
  await expect(page.getByText("4.5", { exact: true })).toBeVisible();
  await expect(page.getByText("2 people have answered")).toBeVisible();
  await expect(guest.getByText("You answered 5")).toBeVisible();

  await guest.context().close();
});

test("no pulse check when the intro phase is disabled", async ({ page, newRetro }) => {
  await newRetro(page, { disable: ["Intro & Pulse"] });
  await expect(page.getByText("30-minute agenda")).toBeVisible();
  await expect(page.getByText("Pulse check")).toHaveCount(0);
});
