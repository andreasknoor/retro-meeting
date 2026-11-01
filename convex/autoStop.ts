import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { PHASES } from "./lib/agenda";
import { autoStopAction } from "./lib/autoStop";
import { finishedTimer, pausedTimer } from "./phase";

// Retros in progress are few: the forgotten ones get finished and drop out of the index range.
const MAX_PER_PHASE = 500;

/**
 * Last sign of use, read only when checking: phase commands and agenda changes (`controlledAt`),
 * the start of the current phase, and the newest idea and action. Not stored on every write,
 * because almost every query reads the retro document (database I/O, write conflicts).
 */
async function lastActivityAt(ctx: MutationCtx, retro: Doc<"retros">): Promise<number> {
  const idea = await ctx.db
    .query("ideas")
    .withIndex("by_retroId", (q) => q.eq("retroId", retro._id))
    .order("desc")
    .first();
  const action = await ctx.db
    .query("actions")
    .withIndex("by_retroId", (q) => q.eq("retroId", retro._id))
    .order("desc")
    .first();
  return Math.max(
    retro._creationTime,
    retro.controlledAt ?? 0,
    retro.phaseStartedAt ?? 0,
    idea?._creationTime ?? 0,
    action?._creationTime ?? 0,
  );
}

/** Cron job (convex/crons.ts): pauses or finishes forgotten retros (rules in lib/autoStop.ts). */
export const run = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const phase of PHASES) {
      const retros = await ctx.db
        .query("retros")
        .withIndex("by_state", (q) => q.eq("state", phase))
        .take(MAX_PER_PHASE);
      for (const retro of retros) {
        const action = autoStopAction(retro, await lastActivityAt(ctx, retro), now);
        // `controlledAt` stays: an automatic stop is no activity.
        if (action === "finished") {
          await ctx.db.patch("retros", retro._id, { ...finishedTimer, autoStopped: "finished" });
        } else if (action === "paused" && retro.phaseStartedAt !== undefined && retro.phaseDurationSec !== undefined) {
          await ctx.db.patch("retros", retro._id, {
            ...pausedTimer(retro.phaseStartedAt, retro.phaseDurationSec, now),
            autoStopped: "paused",
          });
        }
      }
    }
    return null;
  },
});
