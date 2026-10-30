import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

async function showColumn(page: Page, column: string) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${column} \\(`) });
  if (await tab.isVisible()) await tab.click();
}

const cards = (page: Page, column: string) => page.getByRole("region", { name: column }).getByRole("listitem");

test("one vote per column, movable, and columns re-rank live", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page, { disable: ["Intro & Pulse"] });
  const guest = await joinAsGuest(browser, url);

  for (const text of ["Stand-ups", "Pairing", "Demos"]) {
    await page.getByLabel("New idea for Keep").fill(text);
    await page.getByLabel("New idea for Keep").press("Enter");
  }
  await expect(cards(guest, "Keep")).toHaveCount(3);
  await expect(cards(guest, "Keep").first().getByRole("button", { name: "+ Vote" })).toBeDisabled();

  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await page.getByRole("button", { name: "Start Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("3 of 3 votes left");

  // Guest votes for "Demos", then moves the vote to "Pairing".
  await showColumn(guest, "Keep");
  await cards(guest, "Keep").filter({ hasText: "Demos" }).getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("2 of 3 votes left");
  await cards(guest, "Keep").filter({ hasText: "Pairing" }).getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("2 of 3 votes left");

  // Creator also votes "Pairing": it ranks first with the badge for everyone.
  await showColumn(page, "Keep");
  await cards(page, "Keep").filter({ hasText: "Pairing" }).getByRole("button", { name: "+ Vote" }).click();
  for (const p of [page, guest]) {
    await showColumn(p, "Keep");
    await expect(cards(p, "Keep").first()).toContainText("Top in Keep");
    await expect(cards(p, "Keep").first()).toContainText("Pairing");
    await expect(cards(p, "Keep").first()).toContainText("2 votes");
    await expect(cards(p, "Keep").filter({ hasText: "Demos" })).toContainText("0 votes");
  }

  // Taking the vote back.
  await cards(page, "Keep").filter({ hasText: "Pairing" }).getByRole("button", { name: "✓ Voted" }).click();
  await expect(cards(guest, "Keep").filter({ hasText: "Pairing" })).toContainText("1 vote");

  // After the Vote phase the buttons lock but the ranking stays.
  await page.getByRole("button", { name: "Start Discuss & Act" }).click();
  await expect(cards(guest, "Keep").first().getByRole("button", { name: "✓ Voted" })).toBeDisabled();
  await expect(cards(guest, "Keep").first()).toContainText("Pairing");

  // Going back to Vote reopens voting with the votes kept.
  await page.getByRole("button", { name: "Back to Vote" }).click();
  await expect(cards(guest, "Keep").first().getByRole("button", { name: "✓ Voted" })).toBeEnabled();
  await expect(cards(guest, "Keep").first()).toContainText("1 vote");

  // Going back before Vote warns and deletes all votes.
  await page.getByRole("button", { name: "Back to Brainstorm" }).click();
  await expect(page.getByRole("alertdialog", { name: "Confirm going back" })).toContainText("deletes all votes");
  await page.getByRole("button", { name: "Delete votes & go back" }).click();
  await page.getByRole("button", { name: "Start Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("3 of 3 votes left");
  await expect(cards(guest, "Keep").first()).toContainText("0 votes");

  await guest.context().close();
});
