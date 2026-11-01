import { defineConfig, devices } from "@playwright/test";

// Three targets:
// - E2E_BASE_URL set → test that deployment (CI runs the @smoke tests against production).
// - E2E_CONVEX=cloud → build and start the app locally against the Convex dev deployment from
//   .env.local (uses up the cloud database I/O; only when the local backend can't reproduce something).
// - Otherwise → build and start the app locally against a local Convex backend
//   (scripts/e2e-backend.mjs), so test runs cost no cloud database I/O.
// A production build on port 3100 avoids dev-server compile delays under parallel tests.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const cloud = process.env.E2E_CONVEX === "cloud";
// Must match E2E_CONVEX_URL in scripts/e2e-backend.mjs.
const E2E_CONVEX_URL = "http://127.0.0.1:3210";
const app = "npm run build && npx next start -p 3100";

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
    : cloud
      ? { command: app, url: baseURL, reuseExistingServer: false, timeout: 240_000 }
      : [
          { command: "node scripts/e2e-backend.mjs", url: "http://127.0.0.1:3209", reuseExistingServer: false, timeout: 240_000 },
          {
            command: app,
            url: baseURL,
            reuseExistingServer: false,
            timeout: 240_000,
            // Process env wins over .env.local, so the build talks to the local backend.
            env: { NEXT_PUBLIC_CONVEX_URL: E2E_CONVEX_URL, NEXT_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3211" },
          },
        ],
});
