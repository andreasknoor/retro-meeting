import { chromium } from "@playwright/test";
const [out, tag] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto("http://localhost:3000/new");
await p.getByLabel("Name *").fill("Sprint 42 Retro");
await p.getByLabel("Goal / subtitle").fill("What to keep, fix and try in the next sprint.");
await p.getByLabel("Facilitator *").fill("Alex Morgan");
await p.getByLabel(/Admin password/).fill("secret1");
await p.getByLabel("Repeat password *").fill("secret1");
await p.getByRole("button", { name: "Create retro" }).click();
await p.waitForURL(/\/r\//);
for (const step of (process.env.STEPS ?? "").split(";").filter(Boolean)) {
  const [kind, ...rest] = step.split(":"); const arg = rest.join(":");
  if (kind === "click") await p.getByRole("button", { name: arg, exact: true }).first().click();
  if (kind === "fill") { const [label, text] = arg.split("="); await p.getByLabel(label).first().fill(text); }
  if (kind === "press") await p.keyboard.press(arg);
  if (kind === "wait") await p.waitForTimeout(Number(arg));
}
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/${tag}-desktop.png`, fullPage: true });
await p.setViewportSize({ width: 390, height: 800 });
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/${tag}-mobile.png`, fullPage: true });
await b.close();
