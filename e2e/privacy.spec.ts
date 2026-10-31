import { expect, test } from "./fixtures";

// Acceptance §10: nothing the browser receives reveals secrets or who wrote / voted / answered what.
test("realtime traffic contains no secrets or other participants' ids", async ({ page, browser, newRetro }) => {
  const url = await newRetro(page, { anyoneControlsPhases: true });
  await page.getByLabel("New idea for Keep").fill("Creator idea");
  await page.getByLabel("New idea for Keep").press("Enter");
  await page.getByRole("button", { name: /^4\s*Good$/ }).click();
  const creatorId = await page.evaluate(() => localStorage.getItem("retro:participant"));
  expect(creatorId).toBeTruthy();

  const context = await browser.newContext();
  const frames: string[] = [];
  context.on("page", (p) =>
    p.on("websocket", (ws) => ws.on("framereceived", (f) => frames.push(typeof f.payload === "string" ? f.payload : f.payload.toString()))),
  );
  const guest = await context.newPage();
  await guest.goto(url);
  await expect(guest.getByText("Creator idea")).toBeVisible();
  await expect(guest.getByText("1 person has answered")).toBeVisible();
  await guest.getByRole("button", { name: "Start Intro & Pulse" }).click();
  await guest.getByRole("button", { name: "Start Brainstorm" }).click();
  await guest.getByRole("button", { name: "Start Vote" }).click();
  await page.getByRole("region", { name: "Keep" }).getByRole("button", { name: "+ Vote" }).click();
  await expect(guest.getByLabel("Participants")).toContainText("1 has voted");
  await guest.getByRole("button", { name: "Start Discuss & Act" }).click();
  await expect(guest.getByRole("region", { name: "Keep" })).toContainText("1 vote");

  const traffic = frames.join("\n");
  expect(traffic.length).toBeGreaterThan(0);
  for (const secret of ["passwordHash", "passwordSalt", "authorId", "tokenHash", creatorId!]) {
    expect(traffic, `"${secret}" must not reach other browsers`).not.toContain(secret);
  }
  await context.close();
});
