import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { adminRetro } from "./lib/adminAuth";
import { backDiscardsVotes, nextState, previousPhase } from "./lib/phases";
import { getRetroOrThrow } from "./lib/retroAccess";
import { stateValidator } from "./schema";

// Who may switch phases is set per retro: only the admin (default) or anyone with the link.
// `token` is the admin session token, passed in by the Next.js server from the HTTP-only cookie.
// Every mutation takes the state the caller saw (`from`); if someone else switched first, the
// click is ignored instead of skipping a phase.

// 3 votes per participant; far above any real retro, keeps the deletion in one transaction.
const MAX_VOTES_PER_RETRO = 3000;

async function controllableRetro(ctx: MutationCtx, slug: string, token: string | undefined): Promise<Doc<"retros">> {
  const retro = await getRetroOrThrow(ctx, slug);
  if (retro.adminControlsPhases && !(await adminRetro(ctx, slug, token ?? "", Date.now()))) {
    throw new ConvexError("Only the admin can switch phases.");
  }
  return retro;
}

export const startNext = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
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
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_retroId_and_participantId_and_column", (q) => q.eq("retroId", retro._id))
        .take(MAX_VOTES_PER_RETRO);
      if (votes.length > 0 && !discardVotes) throw new ConvexError("Going back deletes all votes. Please confirm.");
      const touched = new Set(votes.map((vote) => vote.ideaId));
      for (const vote of votes) await ctx.db.delete("votes", vote._id);
      for (const ideaId of touched) {
        if (await ctx.db.get("ideas", ideaId)) await ctx.db.patch("ideas", ideaId, { voteCount: 0 });
      }
    }
    await ctx.db.patch("retros", retro._id, {
      state: previous,
      phaseStartedAt: Date.now(),
      phaseDurationSec: retro.agenda[previous] * 60,
    });
    return null;
  },
});

export const extend = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || retro.phaseStartedAt === undefined || retro.phaseDurationSec === undefined) return null;
    await ctx.db.patch("retros", retro._id, { phaseDurationSec: retro.phaseDurationSec + 60 });
    return null;
  },
});

/** Stops the timer; the phase stays current until someone starts the next one. */
export const endEarly = mutation({
  args: { slug: v.string(), from: stateValidator, token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, from, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    if (retro.state !== from || retro.phaseStartedAt === undefined) return null;
    await ctx.db.patch("retros", retro._id, { phaseStartedAt: undefined, phaseDurationSec: undefined });
    return null;
  },
});

/** Back to "not started"; ideas, votes, answers and actions are kept. */
export const reset = mutation({
  args: { slug: v.string(), token: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { slug, token }) => {
    const retro = await controllableRetro(ctx, slug, token);
    await ctx.db.patch("retros", retro._id, { state: "not_started", phaseStartedAt: undefined, phaseDurationSec: undefined });
    return null;
  },
});
