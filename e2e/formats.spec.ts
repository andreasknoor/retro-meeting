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

  // Before the start: everyone sees the question; only the admin can change it.
  await expect(guest.getByText("Coffee or tea?")).toBeVisible();
  await expect(guest.getByText("Answers open when the Check-in phase starts.")).toBeVisible();
  await expect(guest.getByRole("button", { name: "Another question" })).toHaveCount(0);
  await page.getByRole("button", { name: "Write your own" }).click();
  await page.getByLabel("Your question").fill("One word for the sprint?");
  await page.getByRole("button", { name: "Use this question" }).click();
  await expect(guest.getByText("One word for the sprint?")).toBeVisible();

  // The Check-in phase: written answers; others' show once you have answered.
  await page.getByRole("button", { name: "Start Check-in" }).click();
  await page.getByLabel("Your answer", { exact: true }).fill("Focused");
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(guest.getByText("1 person has answered. The answers show once you have answered too.")).toBeVisible();
  await expect(guest.getByLabel("Participants")).toHaveText("2 online· 1 has answered");
  await guest.getByLabel("Your answer", { exact: true }).fill("Sleepy");
  await guest.getByLabel("Initials for your answer").fill("GU");
  await guest.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(page.getByRole("list", { name: "Check-in answers" }).getByRole("listitem")).toHaveText(["Focused", "SleepyGU"]);

  await page.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await expect(guest.getByText("One word for the sprint?")).toHaveCount(0);
  await page.getByRole("button", { name: "Start Brainstorm" }).click();

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
  // A second tab of the same guest shows what the server has: both votes have arrived (a reload
  // could cut off a vote that is still on its way).
  const check = await guest.context().newPage();
  await check.goto(url);
  await showColumn(check, "Start");
  await expect(cards(check, "Start").getByRole("button", { name: "✓ Voted" })).toHaveCount(2);
  await check.close();

  await page.getByRole("button", { name: "Start Discuss & Act" }).click();
  await showColumn(page, "Start");
  await expect(cards(page, "Start").filter({ hasText: "Pairing" })).toContainText("1 vote");
  await expect(cards(page, "Start").filter({ hasText: "Demos" })).toContainText("1 vote");

  await guest.context().close();
});

test("the drawn check-in question is visible in the form and can be drawn again", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByLabel("Drawn check-in question")).toHaveCount(0);
  await page.getByRole("checkbox", { name: /^Check-in/ }).check();
  const drawn = page.getByLabel("Drawn check-in question");
  await expect(drawn).toBeVisible();
  const first = await drawn.textContent();
  await page.getByRole("button", { name: "Another question" }).click();
  await expect(drawn).not.toHaveText(first!);
});
