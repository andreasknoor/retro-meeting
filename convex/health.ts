import { query } from "./_generated/server";

// Smoke test for the M0 deployment: proves the client can reach Convex.
export const ping = query({
  args: {},
  handler: async () => ({ ok: true, serverTime: Date.now() }),
});
