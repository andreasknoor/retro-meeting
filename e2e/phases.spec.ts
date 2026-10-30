import { expect, test } from "./fixtures";
import { E2E_PASSWORD, joinAsGuest, timerSeconds } from "./helpers";

test("only the admin switches phases by default; guests can log in inline", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const guest = await joinAsGuest(browser, url);

  // The creator is logged in as admin automatically; the guest only sees a hint.
  await expect(guest.getByText("The facilitator controls the phases.")).toBeVisible();
  await expect(guest.getByRole("button", { name: /^Start / })).toHaveCount(0);
  await page.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await expect(guest.getByRole("timer")).toContainText("Intro & Pulse");

  // Same countdown in both browsers (±1 s).
  await expect.poll(async () => Math.abs((await timerSeconds(page)) - (await timerSeconds(guest)))).toBeLessThanOrEqual(1);
  expect(await timerSeconds(page)).toBeGreaterThan(200);

  await page.getByRole("button", { name: "+1 min" }).click();
  await expect.poll(() => timerSeconds(guest)).toBeGreaterThan(4 * 60);

  // A co-facilitator who knows the password takes over.
  await guest.getByRole("button", { name: /Log in to control/ }).click();
  await guest.getByLabel("Admin password").fill(E2E_PASSWORD);
  await guest.getByLabel("Admin password").press("Enter");
  await guest.getByRole("button", { name: "Start Brainstorm" }).click({ timeout: 30_000 });
  await expect(page.getByRole("timer")).toContainText("Brainstorm");

  await guest.context().close();
});

test("when everyone may switch, guests control phases too", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page, { anyoneControlsPhases: true });
  const guest = await joinAsGuest(browser, url);

  await guest.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await expect(page.getByRole("timer")).toContainText("Intro & Pulse");
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
  await expect(page.getByRole("button", { name: "Start Discuss & Act" })).toBeVisible();
  await page.getByRole("button", { name: "Start Discuss & Act" }).click();
  await page.getByRole("button", { name: "Finish retro" }).click();
  await expect(page.getByRole("timer")).toContainText("Finished");

  // Back steps over disabled phases and restarts the phase with its full time.
  await page.getByRole("button", { name: "Back to Discuss & Act" }).click();
  await expect(page.getByRole("timer")).toContainText("Discuss & Act");
  await page.getByRole("button", { name: "Back to Brainstorm" }).click();
  await expect(page.getByRole("timer")).toContainText("Brainstorm");
  await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
});
