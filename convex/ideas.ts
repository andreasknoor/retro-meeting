import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { IDEA_LIMITS, normalizeInitials } from "./lib/columns";
import { assertParticipantId, findRetro, getRetroOrThrow } from "./lib/retroAccess";
import { columnValidator } from "./schema";

// Bounds every read of a retro's ideas; far above what a 30–90 minute retro produces.
export const MAX_IDEAS = 300;

const ideaValidator = v.object({
  id: v.id("ideas"),
  column: columnValidator,
  text: v.string(),
  initials: v.union(v.string(), v.null()),
  voteCount: v.number(),
  createdAt: v.number(),
  isMine: v.boolean(),
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
    return ideas.map((idea) => ({
      id: idea._id,
      column: idea.column,
      text: idea.text,
      initials: idea.initials ?? null,
      voteCount: idea.voteCount,
      createdAt: idea._creationTime,
      isMine: idea.authorId === participantId,
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
    const existing = await ctx.db
      .query("ideas")
      .withIndex("by_retroId", (q) => q.eq("retroId", retro._id))
      .take(MAX_IDEAS);
    if (existing.length >= MAX_IDEAS) throw new ConvexError("This retro has reached the maximum number of ideas.");

    return await ctx.db.insert("ideas", {
      retroId: retro._id,
      column: args.column,
      text,
      initials: initials || undefined,
      authorId: args.participantId,
      voteCount: 0,
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
  await ctx.db.delete("ideas", ideaId);
}
