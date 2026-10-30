import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

const actionForm = (page: Page) => page.getByRole("form", { name: "New action" });
const actionList = (page: Page) => page.getByRole("list", { name: "Actions" });

async function showColumn(page: Page, column: string) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${column} \\(`) });
  if (await tab.isVisible()) await tab.click();
}

test("free-text actions anytime, Make action only in Discuss, visible to everyone, deleted by author or admin", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page, { disable: ["Intro & Pulse", "Vote"] });
  const guest = await joinAsGuest(browser, url);

  // Free text before the retro starts.
  await actionForm(page).getByLabel("Action").fill("Book a demo slot");
  await expect(actionForm(page).getByRole("button", { name: "Add action" })).toBeDisabled();
  await actionForm(page).getByLabel("Owner").fill("Sam");
  await actionForm(page).getByLabel("Due date").fill("2099-12-20");
  await actionForm(page).getByRole("button", { name: "Add action" }).click();
  await expect(actionList(guest)).toContainText("Book a demo slot");

  await showColumn(page, "Fix");
  await page.getByLabel("New idea for Fix").fill("Flaky tests");
  await page.getByLabel("New idea for Fix").press("Enter");
  const idea = page.getByRole("region", { name: "Fix" }).getByRole("listitem").first();
  await expect(idea.getByRole("button", { name: "Make action" })).toBeDisabled();

  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await page.getByRole("button", { name: "Start Discuss & Act" }).click();
  await idea.getByRole("button", { name: "Make action" }).click();

  await expect(actionForm(page).getByLabel("Action")).toHaveValue("Flaky tests");
  await expect(actionForm(page).getByLabel("Owner")).toBeFocused();
  await expect(actionForm(page)).toContainText("From Fix");
  await actionForm(page).getByLabel("Action").fill("Quarantine flaky tests");
  await actionForm(page).getByLabel("Owner").fill("Alex");
  await actionForm(page).getByLabel("Due date").fill("2099-11-15");
  await actionForm(page).getByRole("button", { name: "Add action" }).click();

  // Sorted by due date, linked to the idea, live for the guest.
  await expect(actionList(guest).getByRole("listitem")).toHaveText([/Quarantine flaky tests.*from Fix.*Alex.*15\.11\.2099/, /Book a demo slot.*Sam.*20\.12\.2099/]);
  await showColumn(guest, "Fix");
  await expect(guest.getByRole("region", { name: "Fix" })).toContainText("→ Action");

  // The guest edits the owner.
  await actionList(guest).getByRole("listitem").first().getByRole("button", { name: "Edit" }).click();
  const edit = guest.getByRole("form", { name: "Edit action" });
  await edit.getByLabel("Owner").fill("Kim");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(actionList(page).getByRole("listitem").first()).toContainText("Kim");

  // Only the author (or the admin) may delete, after confirming: the guest adds an action
  // without a due date (listed last) and deletes it.
  await expect(actionList(guest).getByRole("button", { name: "Delete" })).toHaveCount(0);
  await actionForm(guest).getByLabel("Action").fill("Guest action");
  await actionForm(guest).getByLabel("Owner").fill("Bo");
  await actionForm(guest).getByRole("button", { name: "Add action" }).click();
  await expect(actionList(page).getByRole("listitem").last()).toContainText(/Guest action.*Bo.*—/);
  const guestAction = actionList(guest).getByRole("listitem").filter({ hasText: "Guest action" });
  await guestAction.getByRole("button", { name: "Delete" }).click();
  await guestAction.getByRole("button", { name: "Yes, delete" }).click();
  await expect(actionList(page)).not.toContainText("Guest action");
  await expect(actionList(guest).getByRole("listitem")).toHaveCount(2);

  await guest.context().close();
});
