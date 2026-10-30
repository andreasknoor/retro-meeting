import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { canMakeActionFromIdea } from "./lib/phases";
import { enforce } from "./lib/rateLimits";
import { assertParticipantId, findRetro, getRetroOrThrow } from "./lib/retroAccess";
import { ACTION_LIMITS, isIsoDate } from "./lib/validation";
import { columnValidator } from "./schema";

export const MAX_ACTIONS = 200;

type ActionFields = { text: string; owner: string; dueDate: string };

/** Trims and validates; every action needs text, an owner and a due date (§4.7). */
function cleanFields({ text, owner, dueDate }: ActionFields): ActionFields {
  const fields = { text: text.trim(), owner: owner.trim(), dueDate };
  if (!fields.text) throw new ConvexError("Describe the action.");
  if (fields.text.length > ACTION_LIMITS.text)
    throw new ConvexError(`An action can have at most ${ACTION_LIMITS.text} characters.`);
  if (!fields.owner) throw new ConvexError("Every action needs an owner.");
  if (fields.owner.length > ACTION_LIMITS.owner)
    throw new ConvexError(`The owner can have at most ${ACTION_LIMITS.owner} characters.`);
  if (!isIsoDate(dueDate)) throw new ConvexError("Every action needs a valid due date.");
  return fields;
}

async function actionsOf(ctx: QueryCtx, retroId: Id<"retros">): Promise<Doc<"actions">[]> {
  return await ctx.db
    .query("actions")
    .withIndex("by_retroId", (q) => q.eq("retroId", retroId))
    .take(MAX_ACTIONS);
}

/** Sorted by due date, then creation. */
export const list = query({
  args: { slug: v.string(), participantId: v.string() },
  returns: v.array(
    v.object({
      id: v.id("actions"),
      text: v.string(),
      owner: v.string(),
      dueDate: v.string(),
      createdAt: v.number(),
      isMine: v.boolean(),
      idea: v.union(v.object({ id: v.id("ideas"), column: columnValidator }), v.null()),
    }),
  ),
  handler: async (ctx, { slug, participantId }) => {
    const retro = await findRetro(ctx, slug);
    if (!retro) return [];
    const actions = await actionsOf(ctx, retro._id);
    const rows = await Promise.all(
      actions.map(async (a) => {
        const idea = a.ideaId ? await ctx.db.get("ideas", a.ideaId) : null;
        return {
          id: a._id,
          text: a.text,
          owner: a.owner,
          dueDate: a.dueDate,
          createdAt: a._creationTime,
          isMine: a.authorId !== undefined && a.authorId === participantId,
          idea: idea ? { id: idea._id, column: idea.column } : null,
        };
      }),
    );
    return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt);
  },
});

/** Free-text actions are possible in every phase; turning an idea into an action only in Discuss. */
export const add = mutation({
  args: {
    slug: v.string(),
    participantId: v.string(),
    text: v.string(),
    owner: v.string(),
    dueDate: v.string(),
    ideaId: v.optional(v.id("ideas")),
  },
  returns: v.id("actions"),
  handler: async (ctx, { slug, participantId, ideaId, ...input }) => {
    assertParticipantId(participantId);
    const fields = cleanFields(input);
    const retro = await getRetroOrThrow(ctx, slug);
    await enforce(ctx, "participantWrites", participantId);
    if ((await actionsOf(ctx, retro._id)).length >= MAX_ACTIONS)
      throw new ConvexError("This retro has reached the maximum number of actions.");
    if (ideaId) {
      const idea = await ctx.db.get("ideas", ideaId);
      if (!idea || idea.retroId !== retro._id) throw new ConvexError("This idea was deleted.");
      if (!canMakeActionFromIdea(retro.state, retro.enabledPhases))
        throw new ConvexError("Ideas can only become actions during the Discuss & Act phase.");
    }
    return await ctx.db.insert("actions", { retroId: retro._id, ideaId, authorId: participantId, ...fields });
  },
});

export const update = mutation({
  args: { actionId: v.id("actions"), text: v.string(), owner: v.string(), dueDate: v.string() },
  returns: v.null(),
  handler: async (ctx, { actionId, ...input }) => {
    const fields = cleanFields(input);
    if (!(await ctx.db.get("actions", actionId))) throw new ConvexError("This action was deleted.");
    await ctx.db.patch("actions", actionId, fields);
    return null;
  },
});

/** Everyone can edit an action (above), but only its author deletes it here; admins use admin.removeAction. */
export const remove = mutation({
  args: { actionId: v.id("actions"), participantId: v.string() },
  returns: v.null(),
  handler: async (ctx, { actionId, participantId }) => {
    const action = await ctx.db.get("actions", actionId);
    if (!action) return null;
    if (action.authorId === undefined || action.authorId !== participantId)
      throw new ConvexError("Only the person who added this action or the admin can delete it.");
    await ctx.db.delete("actions", actionId);
    return null;
  },
});
