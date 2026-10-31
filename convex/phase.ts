import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { adminRetro } from "./lib/adminAuth";
import { IDEA_LIMITS } from "./lib/columns";
import { backDiscardsVotes, nextState, previousPhase } from "./lib/phases";
import { getRetroOrThrow } from "./lib/retroAccess";
import { stateValidator } from "./schema";

// Who may switch phases is set per retro: only the admin (default) or anyone with the link.
// `token` is the admin session token, passed in by the Next.js server from the HTTP-only cookie.
// Every mutation takes the state the caller saw (`from`); if someone else switched first, the
// click is ignored instead of skipping a phase.

async function controllableRetro(ctx: MutationCtx, slug: string, token: string | undefined): Promise<Doc<"retros">> {
  const retro = await getRetroOrThrow(ctx, slug);
  if (retro.adminControlsPhases && !(await adminRetro(ctx, slug, token ?? "", Date.now()))) {
    throw new ConvexError("Only the admin can switch phases.");
  }
  return retro;
}

/** Deletes all votes of the retro; throws unless confirmed when there are any. */
async function discardAllVotes(ctx: MutationCtx, retroId: Id<"retros">, confirmed: boolean, message: string) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_retroId_and_participantId_and_column", (q) => q.eq("retroId", retroId))
    .take(IDEA_LIMITS.votesPerRetro);
  if (votes.length > 0 && !confirmed) throw new ConvexError(message);
  for (const vote of votes) await ctx.db.delete("votes", vote._id);
}

// Starting or returning to a phase always runs its timer from the full planned duration.
const startPhase = (retro: Doc<"retros">, phase: keyof Doc<"retros">["agenda"]) => ({
  state: phase,
  phaseStartedAt: Date.now(),
  phaseDurationSec: retro.agenda[phase] * 60,
  pausedRemainingSec: undefined,
});

export const startNext = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || from === "finished") return null;
    const next = nextState(from, retro.enabledPhases);
    if (next === "finished" || next === "not_started") {
      await ctx.db.patch("retros", retro._id, {
        state: "finished",
        phaseStartedAt: undefined,
        phaseDurationSec: undefined,
        pausedRemainingSec: undefined,
      });
    } else {
      await ctx.db.patch("retros", retro._id, startPhase(retro, next));
    }
    return null;
  },
});

/**
 * One phase back (e.g. Discuss → Vote when someone moved on too early). The earlier phase
 * restarts with its full planned duration. Going back before the Vote phase deletes all votes
 * (decision after v0.12); if there are votes, the caller must confirm with `discardVotes`.
 */
export const back = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()), discardVotes: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token, discardVotes }) => {
    const retro = await controllableRetro(ctx, slug, token);
    const previous = previousPhase(from, retro.enabledPhases);
    if (retro.state !== from || previous === null) return null;
    if (backDiscardsVotes(from, retro.enabledPhases)) {
      await discardAllVotes(ctx, retro._id, discardVotes === true, "Going back deletes all votes. Please confirm.");
    }
    await ctx.db.patch("retros", retro._id, startPhase(retro, previous));
    return null;
  },
});

/** +1 min, also while paused (then it adds to the paused remainder). */
export const extend = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || from === "not_started" || from === "finished") return null;
    if (retro.phaseStartedAt !== undefined && retro.phaseDurationSec !== undefined) {
      await ctx.db.patch("retros", retro._id, { phaseDurationSec: retro.phaseDurationSec + 60 });
    } else {
      await ctx.db.patch("retros", retro._id, { pausedRemainingSec: (retro.pausedRemainingSec ?? 0) + 60 });
    }
    return null;
  },
});

/** Stops the timer and keeps the remaining time (negative when in overtime). */
export const pause = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || retro.phaseStartedAt === undefined || retro.phaseDurationSec === undefined) return null;
    await ctx.db.patch("retros", retro._id, {
      phaseStartedAt: undefined,
      phaseDurationSec: undefined,
      // Same rounding as the client's countdown (lib/timer.ts), so the clock doesn't jump.
      pausedRemainingSec: Math.ceil(retro.phaseDurationSec - (Date.now() - retro.phaseStartedAt) / 1000),
    });
    return null;
  },
});

/**
 * Runs the timer again from the paused remainder. Retros stopped with the old "End early"
 * (before v1.7) have no remainder and resume at 0:00, i.e. straight into overtime.
 */
export const resume = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || from === "not_started" || from === "finished" || retro.phaseStartedAt !== undefined) return null;
    await ctx.db.patch("retros", retro._id, {
      phaseStartedAt: Date.now(),
      phaseDurationSec: retro.pausedRemainingSec ?? 0,
      pausedRemainingSec: undefined,
    });
    return null;
  },
});

/** Back to "not started"; ideas, answers and actions are kept, votes are deleted (after confirmation). */
export const reset = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()), discardVotes: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token, discardVotes }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || from === "not_started") return null;
    await discardAllVotes(ctx, retro._id, discardVotes === true, "Reset deletes all votes. Please confirm.");
    await ctx.db.patch("retros", retro._id, {
      state: "not_started",
      phaseStartedAt: undefined,
      phaseDurationSec: undefined,
      pausedRemainingSec: undefined,
    });
    return null;
  },
});
