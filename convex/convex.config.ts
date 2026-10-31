import presence from "@convex-dev/presence/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  // Set only on the dev deployment ("true"), so E2E runs aren't throttled by the global limit
  // on new retros. Never set it on production.
  env: { RELAX_CREATE_RETRO_LIMIT: v.optional(v.string()) },
});
app.use(rateLimiter);
app.use(presence);
export default app;
