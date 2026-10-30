import { expect, test } from "./fixtures";
import { joinAsGuest, timerSeconds } from "./helpers";

test("two participants share phases and the countdown", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const guest = await joinAsGuest(browser, url);

  await page.getByRole("button", { name: "Start Intro & Pulse" }).click();
  for (const p of [page, guest]) {
    await expect(p.getByRole("timer")).toContainText("Intro & Pulse");
    await expect(p.getByRole("button", { name: "Start Brainstorm" })).toBeVisible();
  }

  // Same countdown in both browsers (±1 s).
  await expect.poll(async () => Math.abs((await timerSeconds(page)) - (await timerSeconds(guest)))).toBeLessThanOrEqual(1);
  expect(await timerSeconds(page)).toBeGreaterThan(200);

  // The guest can switch too; the creator follows live.
  await guest.getByRole("button", { name: "Start Brainstorm" }).click();
  await expect(page.getByRole("timer")).toContainText("Brainstorm");

  await page.getByRole("button", { name: "+1 min" }).click();
  await expect.poll(() => timerSeconds(guest)).toBeGreaterThan(8 * 60);

  await guest.getByRole("button", { name: "End early" }).click();
  await expect(page.getByRole("timer")).toContainText("Ended");

  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(guest.getByRole("timer")).toContainText("Not started");

  await guest.context().close();
});

test("disabled phases are skipped", async ({ page, newRetro }) => {
  await newRetro(page, { disable: ["Intro & Pulse", "Vote"] });
  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await expect(page.getByRole("button", { name: "Start Discuss" })).toBeVisible();
  await page.getByRole("button", { name: "Start Discuss" }).click();
  await page.getByRole("button", { name: "Finish retro" }).click();
  await expect(page.getByRole("timer")).toContainText("Finished");
});
