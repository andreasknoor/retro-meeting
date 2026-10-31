import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import { env, type ActionCtx, type MutationCtx } from "../_generated/server";

// There are no accounts (§3), so anyone can call the public functions with made-up participant
// ids. These limits slow down scripts without touching normal use. Per-retro caps were tried
// and dropped: any counter shared by a retro made 30 simultaneous voters wait for seconds.

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Global: every new retro runs scrypt. A full E2E run creates about 25, so the dev deployment
  // switches it off with RELAX_CREATE_RETRO_LIMIT (convex.config.ts).
  createRetro: { kind: "token bucket", rate: 60, period: HOUR },
  // Per browser and only its own counter, so people never wait on each other.
  participantWrites: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 30 },
});

type LimitName = "createRetro" | "participantWrites";

const MESSAGES: Record<LimitName, string> = {
  createRetro: "Too many new retros right now. Please try again in a few minutes.",
  participantWrites: "You're going too fast. Please wait a moment.",
};

/** Consumes one unit or throws a readable error. Rolls back with the calling mutation. */
export async function enforce(ctx: MutationCtx | ActionCtx, name: LimitName, key?: string): Promise<void> {
  if (name === "createRetro" && env.RELAX_CREATE_RETRO_LIMIT === "true") return;
  const { ok } = await rateLimiter.limit(ctx, name, key === undefined ? {} : { key });
  if (!ok) throw new ConvexError(MESSAGES[name]);
}
