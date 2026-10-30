import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

test("pulse answers update live and changing an answer does not double-count", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const guest = await joinAsGuest(browser, url);

  // Until you answer, you only see how many have answered, not their scores.
  await page.getByRole("button", { name: /^4\s*Good$/ }).click();
  await expect(guest.getByText("1 person has answered")).toBeVisible();
  await expect(guest.getByText(/Results show once you have answered/)).toBeVisible();
  await expect(guest.getByText("4.0", { exact: true })).toHaveCount(0);
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
