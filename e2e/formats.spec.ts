import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

async function showColumn(page: Page, column: string) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${column} \\(`) });
  if (await tab.isVisible()) await tab.click();
}
const cards = (page: Page, column: string) => page.getByRole("region", { name: column }).getByRole("listitem");

test("format, check-in question, contributor count and votes to spend freely", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page, { format: "Start / Stop / Continue", freeVotes: 2, checkIn: "Coffee or tea?" });
  const guest = await joinAsGuest(browser, url);

  // Check-in: everyone sees it; only the admin can change it.
  await expect(guest.getByText("Coffee or tea?")).toBeVisible();
  await expect(guest.getByRole("button", { name: "Another question" })).toHaveCount(0);
  await page.getByRole("button", { name: "Write your own" }).click();
  await page.getByLabel("Your question").fill("One word for the sprint?");
  await page.getByRole("button", { name: "Use this question" }).click();
  await expect(guest.getByText("One word for the sprint?")).toBeVisible();
  await page.getByRole("button", { name: "Another question" }).click();
  await expect(guest.getByText("One word for the sprint?")).toHaveCount(0);

  await page.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await expect(guest.getByText("Check-in", { exact: true })).toHaveCount(0);

  // The format's columns; the phase bar counts people who added ideas, without names.
  await expect(guest.getByLabel("Participants")).toHaveText("2 online· 0 have added ideas");
  for (const text of ["Pairing", "Demos"]) {
    await showColumn(page, "Start");
    await page.getByLabel("New idea for Start").fill(text);
    await page.getByLabel("New idea for Start").press("Enter");
  }
  await expect(guest.getByLabel("Participants")).toHaveText("2 online· 1 has added ideas");
  await showColumn(guest, "Stop");
  await guest.getByLabel("New idea for Stop").fill("Long meetings");
  await guest.getByLabel("New idea for Stop").press("Enter");
  await expect(page.getByLabel("Participants")).toHaveText("2 online· 2 have added ideas");

  // Two votes to spend freely: both in one column is fine, a third is refused.
  await page.getByRole("button", { name: "Start Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("2 of 2 votes left");
  await showColumn(guest, "Start");
  await cards(guest, "Start").filter({ hasText: "Pairing" }).getByRole("button", { name: "+ Vote" }).click();
  await cards(guest, "Start").filter({ hasText: "Demos" }).getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Votes left")).toHaveText("0 of 2 votes left");
  await showColumn(guest, "Stop");
  await cards(guest, "Stop").first().getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByText("No votes left. Take one back first.")).toBeVisible();
  await expect(page.getByLabel("Participants")).toContainText("1 has voted");

  await page.getByRole("button", { name: "Start Discuss & Act" }).click();
  await showColumn(page, "Start");
  await expect(cards(page, "Start").filter({ hasText: "Pairing" })).toContainText("1 vote");
  await expect(cards(page, "Start").filter({ hasText: "Demos" })).toContainText("1 vote");

  await guest.context().close();
});
