import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

async function addIdea(page: Page, column: "Keep" | "Fix" | "Try", text: string) {
  await mobileTab(page, column);
  await page.getByLabel(`New idea for ${column}`).fill(text);
  await page.getByLabel(`New idea for ${column}`).press("Enter");
}

/** On phones only one column is visible; switch to it first. */
async function mobileTab(page: Page, column: string) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${column} \\(`) });
  if (await tab.isVisible()) await tab.click();
}

function cards(page: Page, column: string) {
  return page.getByRole("region", { name: column }).getByRole("listitem");
}

test("ideas from three participants appear live in creation order", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const bob = await joinAsGuest(browser, url);
  const carol = await joinAsGuest(browser, url);

  await page.getByLabel("Initials for Keep").fill("AK");
  await addIdea(page, "Keep", "Short stand-ups");
  await expect(cards(bob, "Keep")).toHaveCount(1);
  await addIdea(bob, "Keep", "Pairing on bugs");
  await expect(cards(carol, "Keep")).toHaveCount(2);
  await addIdea(carol, "Keep", "Friday demos");
  await addIdea(carol, "Fix", "Flaky tests");

  for (const p of [page, bob, carol]) {
    await mobileTab(p, "Keep");
    await expect(cards(p, "Keep")).toHaveText([/Short stand-upsAK/, /Pairing on bugs/, /Friday demos/]);
    await mobileTab(p, "Fix");
    await expect(cards(p, "Fix")).toHaveText([/Flaky tests/]);
  }

  // Only the author can delete; everyone sees it disappear.
  await mobileTab(bob, "Keep");
  await expect(cards(bob, "Keep").nth(0).getByRole("button", { name: "Delete" })).toHaveCount(0);
  await cards(bob, "Keep").nth(1).getByRole("button", { name: "Delete" }).click();
  await cards(bob, "Keep").nth(1).getByRole("button", { name: "Yes, delete" }).click();
  await mobileTab(page, "Keep");
  await expect(cards(page, "Keep")).toHaveText([/Short stand-ups/, /Friday demos/]);

  await bob.context().close();
  await carol.context().close();
});
