import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

async function showColumn(page: Page, column: string) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${column} \\(`) });
  if (await tab.isVisible()) await tab.click();
}

async function addIdea(page: Page, column: string, text: string) {
  await showColumn(page, column);
  await page.getByLabel(`New idea for ${column}`).fill(text);
  await page.getByLabel(`New idea for ${column}`).press("Enter");
}

const cards = (page: Page, column: string) => page.getByRole("region", { name: column }).getByRole("listitem");

async function vote(page: Page, column: string, text: string) {
  await showColumn(page, column);
  await cards(page, column).filter({ hasText: text }).getByRole("button", { name: "+ Vote" }).click();
}

test("a complete retro with three participants through all phases", async ({ page: alex, browser, newRetro }) => {
  const url = await newRetro(alex);
  const bob = await joinAsGuest(browser, url);
  const carol = await joinAsGuest(browser, url);
  const everyone = [alex, bob, carol];

  // 1) Intro & pulse check
  await alex.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await alex.getByRole("button", { name: /^4\s*Good$/ }).click();
  await bob.getByRole("button", { name: /^5\s*Great$/ }).click();
  await carol.getByRole("button", { name: /^3\s*Okay$/ }).click();
  for (const p of everyone) await expect(p.getByText("3 people have answered")).toBeVisible();
  await expect(bob.getByText("4.0", { exact: true })).toBeVisible();

  // 2) Brainstorm
  await alex.getByRole("button", { name: "Start Brainstorm" }).click();
  await addIdea(alex, "Keep", "Short stand-ups");
  await addIdea(bob, "Keep", "Pairing on bugs");
  await addIdea(carol, "Fix", "Flaky tests");
  await addIdea(bob, "Try", "Async stand-up on Fridays");
  for (const p of everyone) {
    await showColumn(p, "Keep");
    await expect(cards(p, "Keep")).toHaveCount(2);
  }

  // 3) Vote: Pairing gets two votes, Flaky tests one
  await alex.getByRole("button", { name: "Start Vote" }).click();
  await vote(alex, "Keep", "Pairing on bugs");
  await vote(carol, "Keep", "Pairing on bugs");
  await vote(bob, "Fix", "Flaky tests");
  await showColumn(alex, "Keep");
  await expect(cards(alex, "Keep").first()).toContainText("Top in Keep");
  await expect(cards(alex, "Keep").first()).toContainText("Pairing on bugs");
  await expect(cards(alex, "Keep").first()).toContainText("2 votes");

  // 4) Discuss: the top idea becomes an action; Bob adds a free-text action
  await alex.getByRole("button", { name: "Start Discuss" }).click();
  await cards(alex, "Keep").first().getByRole("button", { name: "Make action" }).click();
  const form = (p: Page) => p.getByRole("form", { name: "New action" });
  await form(alex).getByLabel("Owner").fill("Alex");
  await form(alex).getByLabel("Due date").fill("2026-11-15");
  await form(alex).getByRole("button", { name: "Add action" }).click();
  await form(bob).getByLabel("Action").fill("Fix the flaky checkout test");
  await form(bob).getByLabel("Owner").fill("Bob");
  await form(bob).getByLabel("Due date").fill("2026-11-10");
  await form(bob).getByRole("button", { name: "Add action" }).click();

  // 5) Finish: everyone sees the same result
  await alex.getByRole("button", { name: "Finish retro" }).click();
  for (const p of everyone) {
    await expect(p.getByRole("timer")).toContainText("Finished");
    await expect(p.getByRole("list", { name: "Actions" }).getByRole("listitem")).toHaveText([
      /Fix the flaky checkout test.*Bob.*10\.11\.2026/,
      /Pairing on bugs.*from Keep.*Alex.*15\.11\.2026/,
    ]);
  }

  await bob.context().close();
  await carol.context().close();
});
