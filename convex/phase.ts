import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { nextState } from "./lib/phases";
import { getRetroOrThrow } from "./lib/retroAccess";
import { stateValidator } from "./schema";

// Anyone with the link can control phases (decision B.5). Every mutation takes the state the
// caller saw (`from`); if someone else switched first, the click is ignored instead of
// skipping a phase.

export const startNext = mutation({
  args: { slug: v.string(), from: stateValidator },
  returns: v.null(),
  handler: async (ctx, { slug, from }) => {
    const retro = await getRetroOrThrow(ctx, slug);
    if (retro.state !== from || from === "finished") return null;
    const next = nextState(from, retro.enabledPhases);
    if (next === "finished" || next === "not_started") {
      await ctx.db.patch("retros", retro._id, { state: "finished", phaseStartedAt: undefined, phaseDurationSec: undefined });
    } else {
      await ctx.db.patch("retros", retro._id, {
        state: next,
        phaseStartedAt: Date.now(),
        phaseDurationSec: retro.agenda[next] * 60,
      });
    }
    return null;
  },
});

export const extend = mutation({
  args: { slug: v.string(), from: stateValidator },
  returns: v.null(),
  handler: async (ctx, { slug, from }) => {
    const retro = await getRetroOrThrow(ctx, slug);
    if (retro.state !== from || retro.phaseStartedAt === undefined || retro.phaseDurationSec === undefined) return null;
    await ctx.db.patch("retros", retro._id, { phaseDurationSec: retro.phaseDurationSec + 60 });
    return null;
  },
});

/** Stops the timer; the phase stays current until someone starts the next one. */
export const endEarly = mutation({
  args: { slug: v.string(), from: stateValidator },
  returns: v.null(),
  handler: async (ctx, { slug, from }) => {
    const retro = await getRetroOrThrow(ctx, slug);
    if (retro.state !== from || retro.phaseStartedAt === undefined) return null;
    await ctx.db.patch("retros", retro._id, { phaseStartedAt: undefined, phaseDurationSec: undefined });
    return null;
  },
});

/** Back to "not started"; ideas, votes, answers and actions are kept. */
export const reset = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, { slug }) => {
    const retro = await getRetroOrThrow(ctx, slug);
    await ctx.db.patch("retros", retro._id, { state: "not_started", phaseStartedAt: undefined, phaseDurationSec: undefined });
    return null;
  },
});
