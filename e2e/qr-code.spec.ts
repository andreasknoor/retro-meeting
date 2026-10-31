import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("the QR code holds the retro link and passes the accessibility check", async ({ page, newRetro }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const url = await newRetro(page);

  await page.getByRole("button", { name: /QR code/ }).click();
  const dialog = page.getByRole("dialog", { name: "QR code for this retro" });
  await expect(dialog).toContainText(url);
  const qr = dialog.getByRole("img", { name: `QR code for ${url}` });
  await expect(qr.locator("svg")).toBeVisible();
  // Large enough to scan from a shared screen.
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(240);

  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
});
