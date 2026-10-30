import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isScore, MAX_PULSE_ANSWERS, resultsVisible, summarize } from "./lib/pulse";
import { enforce } from "./lib/rateLimits";
import { assertParticipantId, findRetro, getRetroOrThrow } from "./lib/retroAccess";

const summaryValidator = v.object({
  counts: v.array(v.number()),
  total: v.number(),
  average: v.union(v.number(), v.null()),
  mine: v.union(v.number(), v.null()),
  revealed: v.boolean(),
});

/**
 * Aggregates only: who gave which score is never returned (anonymous, §4.4). Until you answer
 * (or the Intro phase is over), only the number of answers is returned, so others' scores
 * cannot anchor yours.
 */
export const summary = query({
  args: { slug: v.string(), participantId: v.string() },
  returns: v.union(summaryValidator, v.null()),
  handler: async (ctx, { slug, participantId }) => {
    const retro = await findRetro(ctx, slug);
    if (!retro) return null;
    const answers = await ctx.db
      .query("pulseAnswers")
      .withIndex("by_retroId_and_participantId", (q) => q.eq("retroId", retro._id))
      .take(MAX_PULSE_ANSWERS);
    const mine = answers.find((a) => a.participantId === participantId)?.score ?? null;
    if (!resultsVisible(retro.state, mine)) {
      return { ...summarize([], null), total: answers.length, revealed: false };
    }
    return {
      ...summarize(
        answers.map((a) => a.score),
        mine,
      ),
      revealed: true,
    };
  },
});

/** One answer per participant; answering again changes it. */
export const answer = mutation({
  args: { slug: v.string(), participantId: v.string(), score: v.number() },
  returns: v.null(),
  handler: async (ctx, { slug, participantId, score }) => {
    assertParticipantId(participantId);
    if (!isScore(score)) throw new ConvexError("Score must be 1 to 5.");
    const retro = await getRetroOrThrow(ctx, slug);
    if (!retro.enabledPhases.includes("intro")) throw new ConvexError("This retro has no pulse check.");
    await enforce(ctx, "participantWrites", participantId);

    const existing = await ctx.db
      .query("pulseAnswers")
      .withIndex("by_retroId_and_participantId", (q) =>
        q.eq("retroId", retro._id).eq("participantId", participantId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("pulseAnswers", existing._id, { score });
    } else {
      await ctx.db.insert("pulseAnswers", { retroId: retro._id, participantId, score });
    }
    return null;
  },
});
