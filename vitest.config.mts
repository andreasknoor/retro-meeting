import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@/": root } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.tsx", "app/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["convex/**/*.ts", "lib/**/*.ts"],
      exclude: ["convex/_generated/**", "**/*.test.ts", "convex/schema.ts", "lib/utils.ts"],
      reporter: ["text", "json-summary", "html"],
      // Release gate from IMPLEMENTATION_PLAN.md §11: backend ≥ 90 %, lib ≥ 80 %.
      thresholds: {
        "convex/**/*.ts": { lines: 90, functions: 90, statements: 90, branches: 85 },
        "lib/**/*.ts": { lines: 80, functions: 80, statements: 80, branches: 75 },
      },
    },
  },
});
