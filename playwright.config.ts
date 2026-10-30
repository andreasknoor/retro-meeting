import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL set → test that deployment (CI runs against Vercel deployments).
// Unset → build and start the app locally on port 3100 against the Convex dev deployment
// from .env.local. A production build avoids dev-server compile delays under parallel tests.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Creating a retro or logging in runs a Convex Node action, which can cold-start.
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  expect: { timeout: 10_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npx next start -p 3100", url: baseURL, reuseExistingServer: false, timeout: 240_000 },
});
