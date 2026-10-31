import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { joinAsGuest } from "./helpers";

/** Distance of the card's top edge below the sticky phase bar (or the window top on phones). */
function gapBelowBar(page: Page, area: string): Promise<number> {
  return page.evaluate((target) => {
    const card = document.querySelector(`[data-focus-area="${target}"]`)!;
    const bar = document.querySelector("[data-phase-bar]")!;
    const top = getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0;
    return Math.round(card.getBoundingClientRect().top - top);
  }, area);
}

const scrollToBottom = (page: Page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
const scrollToTop = (page: Page) => page.evaluate(() => window.scrollTo(0, 0));

test("a phase change scrolls everyone to the highlighted card", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page);
  const guest = await joinAsGuest(browser, url);
  await expect(guest.locator('[data-focus-area="board"]')).toBeVisible();

  // Opening the page does not scroll.
  expect(await guest.evaluate(() => window.scrollY)).toBe(0);

  await scrollToBottom(guest);
  await page.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await expect.poll(() => gapBelowBar(guest, "pulse")).toBe(16);

  await scrollToTop(guest);
  await page.getByRole("button", { name: "Start Brainstorm" }).click();
  await expect.poll(() => gapBelowBar(guest, "board")).toBe(16);

  // Scrolling away right after the jump is not undone.
  await guest.mouse.move(100, 300);
  await guest.mouse.wheel(0, -5000);
  await expect.poll(() => guest.evaluate(() => window.scrollY)).toBe(0);
  await guest.waitForTimeout(1_000);
  expect(await guest.evaluate(() => window.scrollY)).toBe(0);

  // Pausing keeps the position.
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(guest.getByRole("timer")).toContainText("Paused");
  await guest.waitForTimeout(1_000);
  expect(await guest.evaluate(() => window.scrollY)).toBe(0);

  await guest.context().close();
});
