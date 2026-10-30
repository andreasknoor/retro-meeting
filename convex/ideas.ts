import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { MAX_ACTIONS } from "./actions";
import { IDEA_LIMITS, normalizeInitials } from "./lib/columns";
import { enforce } from "./lib/rateLimits";
import { assertParticipantId, findRetro, getRetroOrThrow } from "./lib/retroAccess";
import { columnValidator } from "./schema";

export const MAX_IDEAS = IDEA_LIMITS.perRetro;
// Checked per author, so concurrent adds by different people never read the same rows
// (a retro-wide count made every add conflict with every other one under load).
export const MAX_IDEAS_PER_PARTICIPANT = 30;
// One vote per participant and column: 3 × participants.
export const MAX_VOTES = 3000;

const ideaValidator = v.object({
  id: v.id("ideas"),
  column: columnValidator,
  text: v.string(),
  initials: v.union(v.string(), v.null()),
  voteCount: v.number(),
  createdAt: v.number(),
  isMine: v.boolean(),
  votedByMe: v.boolean(),
  hasAction: v.boolean(),
});

/** All ideas of a retro in creation order; the author is reduced to `isMine` (§6 privacy rules). */
export const list = query({
  args: { slug: v.string(), participantId: v.string() },
  returns: v.array(ideaValidator),
  handler: async (ctx, { slug, participantId }) => {
    const retro = await findRetro(ctx, slug);
    if (!retro) return [];
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_retroId", (q) => q.eq("retroId", retro._id))
      .take(MAX_IDEAS);
    // Counts come from the votes themselves, so a vote never writes to a shared idea document.
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_retroId_and_participantId_and_column", (q) => q.eq("retroId", retro._id))
      .take(MAX_VOTES);
    const counts = new Map<string, number>();
    const votedIds = new Set<string>();
    for (const vote of votes) {
      counts.set(vote.ideaId, (counts.get(vote.ideaId) ?? 0) + 1);
      if (vote.participantId === participantId) votedIds.add(vote.ideaId);
    }
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_retroId", (q) => q.eq("retroId", retro._id))
      .take(MAX_ACTIONS);
    const ideasWithAction = new Set(actions.map((a) => a.ideaId));
    return ideas.map((idea) => ({
      id: idea._id,
      column: idea.column,
      text: idea.text,
      initials: idea.initials ?? null,
      voteCount: counts.get(idea._id) ?? 0,
      createdAt: idea._creationTime,
      isMine: idea.authorId === participantId,
      votedByMe: votedIds.has(idea._id),
      hasAction: ideasWithAction.has(idea._id),
    }));
  },
});

/** Ideas can be added in every phase (§4.5 default). */
export const add = mutation({
  args: {
    slug: v.string(),
    participantId: v.string(),
    column: columnValidator,
    text: v.string(),
    initials: v.string(),
  },
  returns: v.id("ideas"),
  handler: async (ctx, args) => {
    assertParticipantId(args.participantId);
    const text = args.text.trim();
    const initials = normalizeInitials(args.initials);
    if (!text) throw new ConvexError("The idea is empty.");
    if (text.length > IDEA_LIMITS.text) throw new ConvexError(`An idea can have at most ${IDEA_LIMITS.text} characters.`);
    if (initials.length > IDEA_LIMITS.initials)
      throw new ConvexError(`Initials can have at most ${IDEA_LIMITS.initials} characters.`);

    const retro = await getRetroOrThrow(ctx, args.slug);
    const mine = await ctx.db
      .query("ideas")
      .withIndex("by_retroId_and_authorId", (q) => q.eq("retroId", retro._id).eq("authorId", args.participantId))
      .take(MAX_IDEAS_PER_PARTICIPANT);
    if (mine.length >= MAX_IDEAS_PER_PARTICIPANT)
      throw new ConvexError(`You can add at most ${MAX_IDEAS_PER_PARTICIPANT} ideas per retro.`);
    await enforce(ctx, "participantWrites", args.participantId);

    return await ctx.db.insert("ideas", {
      retroId: retro._id,
      column: args.column,
      text,
      initials: initials || undefined,
      authorId: args.participantId,
    });
  },
});

/** Only the author can delete their idea here; admins use the admin variant (M7). */
export const remove = mutation({
  args: { ideaId: v.id("ideas"), participantId: v.string() },
  returns: v.null(),
  handler: async (ctx, { ideaId, participantId }) => {
    const idea = await ctx.db.get("ideas", ideaId);
    if (!idea) return null;
    if (idea.authorId !== participantId) throw new ConvexError("Only the author can delete this idea.");
    await deleteIdea(ctx, ideaId);
    return null;
  },
});

/** Deletes an idea with everything that hangs off it. */
export async function deleteIdea(ctx: MutationCtx, ideaId: Id<"ideas">): Promise<void> {
  // One vote per participant per idea, so this is bounded by the number of participants.
  for await (const vote of ctx.db.query("votes").withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))) {
    await ctx.db.delete("votes", vote._id);
  }
  // Actions stay (they were agreed on); they just lose the link to the idea.
  for await (const action of ctx.db.query("actions").withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))) {
    await ctx.db.patch("actions", action._id, { ideaId: undefined });
  }
  await ctx.db.delete("ideas", ideaId);
}
