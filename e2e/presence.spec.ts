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

  await guest.close({ runBeforeUnload: true });
  await expect(participants).toHaveText(/^1 online/, { timeout: 40_000 });
  await guest.context().close();
});
