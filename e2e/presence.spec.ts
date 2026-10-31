import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

test("shows who is online and counts down when someone leaves", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const participants = page.getByLabel("Participants");
  await expect(participants).toHaveText(/^1 online/);

  const guest = await joinAsGuest(browser, url);
  await expect(participants).toHaveText(/^2 online/);
  await expect(guest.getByLabel("Participants")).toHaveText(/^2 online/);

  // A second tab of the same browser is the same person.
  const secondTab = await page.context().newPage();
  await secondTab.goto(url);
  await expect(secondTab.getByLabel("Participants")).toHaveText(/^2 online/);
  await secondTab.close();

  // A covered or minimised window (e.g. behind the video call) still counts as online.
  await guest.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(3_000);
  await expect(participants).toHaveText(/^2 online/);

  await guest.close({ runBeforeUnload: true });
  await expect(participants).toHaveText(/^1 online/, { timeout: 40_000 });
  await guest.context().close();
});
