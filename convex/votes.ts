import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertParticipantId } from "./lib/retroAccess";

/**
 * One vote per participant per column (decision A.2), only during the Vote phase.
 * Voting for the idea you already voted for takes the vote back; voting for another idea in
 * the same column moves it. Runs as one transaction, so voteCount always matches the votes.
 * Voting for your own idea is allowed (§4.6 default).
 */
export const toggle = mutation({
  args: { ideaId: v.id("ideas"), participantId: v.string() },
  returns: v.union(v.literal("cast"), v.literal("moved"), v.literal("retracted")),
  handler: async (ctx, { ideaId, participantId }) => {
    assertParticipantId(participantId);
    const idea = await ctx.db.get("ideas", ideaId);
    if (!idea) throw new ConvexError("This idea was deleted.");
    const retro = await ctx.db.get("retros", idea.retroId);
    if (retro?.state !== "vote") throw new ConvexError("Voting is only possible during the Vote phase.");

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_retroId_and_participantId_and_column", (q) =>
        q.eq("retroId", idea.retroId).eq("participantId", participantId).eq("column", idea.column),
      )
      .unique();

    if (existing?.ideaId === ideaId) {
      await ctx.db.delete("votes", existing._id);
      await ctx.db.patch("ideas", ideaId, { voteCount: Math.max(0, idea.voteCount - 1) });
      return "retracted";
    }
    if (existing) {
      const previous = await ctx.db.get("ideas", existing.ideaId);
      if (previous) await ctx.db.patch("ideas", previous._id, { voteCount: Math.max(0, previous.voteCount - 1) });
      await ctx.db.patch("votes", existing._id, { ideaId });
      await ctx.db.patch("ideas", ideaId, { voteCount: idea.voteCount + 1 });
      return "moved";
    }
    await ctx.db.insert("votes", { retroId: idea.retroId, ideaId, column: idea.column, participantId });
    await ctx.db.patch("ideas", ideaId, { voteCount: idea.voteCount + 1 });
    return "cast";
  },
});
