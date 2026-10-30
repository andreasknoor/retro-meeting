import { v } from "convex/values";
import { action } from "./_generated/server";

// Server time for the client clock offset. An action, because queries must not read the clock.
export const now = action({
  args: {},
  returns: v.number(),
  handler: async () => Date.now(),
});
