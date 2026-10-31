import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

async function showColumn(page: Page, column: string) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${column} \\(`) });
  if (await tab.isVisible()) await tab.click();
}

const cards = (page: Page, column: string) => page.getByRole("region", { name: column }).getByRole("listitem");

test("one vote per column, movable, counts hidden until voting ends, then ranked live", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page, { disable: ["Intro & Pulse"] });
  const guest = await joinAsGuest(browser, url);

  for (const text of ["Stand-ups", "Pairing", "Demos"]) {
    await page.getByLabel("New idea for Keep").fill(text);
    await page.getByLabel("New idea for Keep").press("Enter");
  }
  await expect(cards(guest, "Keep")).toHaveCount(3);
  await expect(cards(guest, "Keep").first().getByRole("button", { name: "+ Vote" })).toHaveCount(0);

  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await page.getByRole("button", { name: "Start Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("3 of 3 votes left");

  // Guest votes for "Demos", then moves the vote to "Pairing".
  await showColumn(guest, "Keep");
  await cards(guest, "Keep").filter({ hasText: "Demos" }).getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("2 of 3 votes left");
  await cards(guest, "Keep").filter({ hasText: "Pairing" }).getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("2 of 3 votes left");
  // The toast comes from the server's answer, so the move has arrived before the phase changes.
  await expect(guest.getByText("Vote moved")).toBeVisible();

  // The creator votes "Pairing", takes it back and votes again. Nobody sees counts or ranking yet.
  await showColumn(page, "Keep");
  const pairing = cards(page, "Keep").filter({ hasText: "Pairing" });
  await pairing.getByRole("button", { name: "+ Vote" }).click();
  await pairing.getByRole("button", { name: "✓ Voted" }).click();
  await expect(page.getByLabel("Votes left")).toHaveText("3 of 3 votes left");
  await pairing.getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Participants")).toContainText("2 have voted");
  for (const p of [page, guest]) {
    await expect(cards(p, "Keep").first()).toContainText("Stand-ups");
    await expect(p.getByRole("region", { name: "Keep" })).not.toContainText(/\d votes?/);
  }

  // After the Vote phase: ranked with counts, no vote buttons.
  await page.getByRole("button", { name: "Start Discuss & Act" }).click();
  for (const p of [page, guest]) {
    await showColumn(p, "Keep");
    await expect(cards(p, "Keep").first()).toContainText("Top in Keep");
    await expect(cards(p, "Keep").first()).toContainText("Pairing");
    await expect(cards(p, "Keep").first()).toContainText("2 votes· incl. yours");
    await expect(cards(p, "Keep").filter({ hasText: "Demos" })).toContainText("0 votes");
    await expect(p.getByRole("button", { name: "+ Vote" })).toHaveCount(0);
  }

  // Going back to Vote reopens voting with the votes kept (and counts hidden again).
  await page.getByRole("button", { name: "Back to Vote" }).click();
  await expect(cards(guest, "Keep").filter({ hasText: "Pairing" }).getByRole("button", { name: "✓ Voted" })).toBeEnabled();
  await expect(guest.getByRole("region", { name: "Keep" })).not.toContainText(/\d votes?/);

  // Going back before Vote warns and deletes all votes.
  await page.getByRole("button", { name: "Back to Brainstorm" }).click();
  await expect(page.getByRole("alertdialog", { name: "Confirm going back" })).toContainText("deletes all votes");
  await page.getByRole("button", { name: "Delete votes & go back" }).click();
  await page.getByRole("button", { name: "Start Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("3 of 3 votes left");

  // Reset also deletes votes, after its own warning.
  await cards(guest, "Keep").first().getByRole("button", { name: "+ Vote" }).click();
  await expect(page.getByLabel("Participants")).toContainText("1 has voted");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("alertdialog", { name: "Confirm reset" })).toContainText("Reset deletes all votes.");
  await page.getByRole("alertdialog", { name: "Confirm reset" }).getByRole("button", { name: "Reset" }).click();
  await expect(guest.getByRole("timer")).toContainText("Not started");
  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await page.getByRole("button", { name: "Start Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("3 of 3 votes left");

  await guest.context().close();
});
