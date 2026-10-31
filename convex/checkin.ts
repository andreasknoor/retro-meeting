import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { IDEA_LIMITS, normalizeInitials } from "./lib/columns";
import { enforce } from "./lib/rateLimits";
import { assertParticipantId, findRetro, getRetroOrThrow } from "./lib/retroAccess";
import { CHECKIN_LIMITS } from "./lib/validation";

// Written answers to the check-in question (Check-in phase, v1.13). One per participant.

/**
 * The question and the answers. Like the pulse check, others' answers show only once you have
 * answered (or the phase is over), so they don't shape yours. Who wrote what is reduced to
 * `isMine` plus the initials people chose to add.
 */
export const list = query({
  args: { slug: v.string(), participantId: v.string() },
  returns: v.union(
    v.object({
      question: v.union(v.string(), v.null()),
      total: v.number(),
      mine: v.union(v.object({ text: v.string(), initials: v.union(v.string(), v.null()) }), v.null()),
      revealed: v.boolean(),
      answers: v.array(v.object({ text: v.string(), initials: v.union(v.string(), v.null()), isMine: v.boolean() })),
    }),
    v.null(),
  ),
  handler: async (ctx, { slug, participantId }) => {
    const retro = await findRetro(ctx, slug);
    if (!retro) return null;
    const rows = await ctx.db
      .query("checkinAnswers")
      .withIndex("by_retroId_and_participantId", (q) => q.eq("retroId", retro._id))
      .take(CHECKIN_LIMITS.perRetro);
    const mineRow = rows.find((a) => a.participantId === participantId);
    const revealed = mineRow !== undefined || (retro.state !== "not_started" && retro.state !== "checkin");
    const answers = revealed
      ? rows
          .sort((a, b) => a._creationTime - b._creationTime)
          .map((a) => ({ text: a.text, initials: a.initials ?? null, isMine: a.participantId === participantId }))
      : [];
    return {
      question: retro.icebreaker ?? null,
      total: rows.length,
      mine: mineRow ? { text: mineRow.text, initials: mineRow.initials ?? null } : null,
      revealed,
      answers,
    };
  },
});

/** Only during the Check-in phase; answering again changes your answer. */
export const answer = mutation({
  args: { slug: v.string(), participantId: v.string(), text: v.string(), initials: v.string() },
  returns: v.null(),
  handler: async (ctx, { slug, participantId, text, initials }) => {
    assertParticipantId(participantId);
    const clean = text.trim();
    const cleanInitials = normalizeInitials(initials);
    if (!clean) throw new ConvexError("The answer is empty.");
    if (clean.length > CHECKIN_LIMITS.answer) throw new ConvexError(`An answer can have at most ${CHECKIN_LIMITS.answer} characters.`);
    if (cleanInitials.length > IDEA_LIMITS.initials) throw new ConvexError(`Initials can have at most ${IDEA_LIMITS.initials} characters.`);
    const retro = await getRetroOrThrow(ctx, slug);
    if (retro.state !== "checkin") throw new ConvexError("Answers are possible during the Check-in phase.");
    await enforce(ctx, "participantWrites", participantId);

    const existing = await ctx.db
      .query("checkinAnswers")
      .withIndex("by_retroId_and_participantId", (q) => q.eq("retroId", retro._id).eq("participantId", participantId))
      .unique();
    const fields = { text: clean, initials: cleanInitials || undefined };
    if (existing) await ctx.db.patch("checkinAnswers", existing._id, fields);
    else await ctx.db.insert("checkinAnswers", { retroId: retro._id, participantId, ...fields });
    return null;
  },
});
