import { test as base, type Page } from "@playwright/test";
import { createRetro, deleteRetro } from "./helpers";

type RetroOptions = Parameters<typeof createRetro>[1];

/**
 * `newRetro` creates a retro through the UI and deletes it (via the admin area) after the
 * test, so E2E runs against production leave no data behind.
 */
export const test = base.extend<{ newRetro: (page: Page, opts?: RetroOptions) => Promise<string> }>({
  newRetro: async ({ browser }, provide) => {
    const created: { url: string; name: string }[] = [];
    await provide(async (page, opts = {}) => {
      const name = opts.name ?? `E2E ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const url = await createRetro(page, { ...opts, name });
      created.push({ url, name });
      return url;
    });
    for (const retro of created) {
      const context = await browser.newContext();
      await deleteRetro(await context.newPage(), retro.url, retro.name);
      await context.close();
    }
  },
});

export { expect } from "@playwright/test";
