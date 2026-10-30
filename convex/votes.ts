import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { enforce } from "./lib/rateLimits";
import { assertParticipantId } from "./lib/retroAccess";

/**
 * One vote per participant per column (decision A.2), only during the Vote phase.
 * Voting for the idea you already voted for takes the vote back; voting for another idea in
 * the same column moves it. Only the caller's own vote row is read and written, so people voting
 * at the same time never conflict (counts are computed in ideas.list).
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
    await enforce(ctx, "participantWrites", participantId);

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_retroId_and_participantId_and_column", (q) =>
        q.eq("retroId", idea.retroId).eq("participantId", participantId).eq("column", idea.column),
      )
      .unique();

    if (existing?.ideaId === ideaId) {
      await ctx.db.delete("votes", existing._id);
      return "retracted";
    }
    if (existing) {
      await ctx.db.patch("votes", existing._id, { ideaId });
      return "moved";
    }
    await ctx.db.insert("votes", { retroId: idea.retroId, ideaId, column: idea.column, participantId });
    return "cast";
  },
});
