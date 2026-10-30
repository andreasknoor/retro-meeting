import { query } from "./_generated/server";
import { v } from "convex/values";

// Smoke test for deployments: proves the client can reach Convex.
export const ping = query({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async () => ({ ok: true }),
});
