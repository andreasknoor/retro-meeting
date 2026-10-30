import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

// Without animations, so contrast is measured on the final state, not mid fade-in.
test.use({ reducedMotion: "reduce" });

// Automated WCAG 2.1 A/AA checks; serious and critical findings fail the test.
async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1] ?? ""}`))).toEqual([]);
}

test("home and create pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.goto("/new");
  await expect(page.getByRole("button", { name: "Create retro" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("retro page as admin and as participant, and the admin area", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  await page.getByLabel("New idea for Keep").fill("An idea");
  await page.getByLabel("New idea for Keep").press("Enter");
  await expect(page.getByRole("region", { name: "Keep" }).getByRole("listitem")).toHaveCount(1);
  await expectNoSeriousViolations(page);

  const guest = await joinAsGuest(browser, url);
  await expect(guest.getByText("Only the admin can switch phases.")).toBeVisible();
  await expectNoSeriousViolations(guest);
  await guest.context().close();

  await page.goto(`${url}/admin`);
  await expect(page.getByText("Agenda times", { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page);
});
