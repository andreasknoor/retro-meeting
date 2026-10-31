import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { calcAgenda, orderPhases } from "./lib/agenda";
import { agendaValidator, phaseValidator, stateValidator } from "./schema";

// The home page keeps at most 20 recent retros (lib/recentRetros.ts).
export const MAX_RECENT_SLUGS = 20;

const publicRetroValidator = v.object({
  slug: v.string(),
  name: v.string(),
  subtitle: v.union(v.string(), v.null()),
  date: v.string(),
  lengthMin: v.number(),
  facilitator: v.string(),
  enabledPhases: v.array(phaseValidator),
  agenda: agendaValidator,
  state: stateValidator,
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseDurationSec: v.union(v.number(), v.null()),
  pausedRemainingSec: v.union(v.number(), v.null()),
  adminControlsPhases: v.boolean(),
});

// Never return the password hash or salt to clients.
function toPublic(r: Doc<"retros">) {
  return {
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle ?? null,
    date: r.date,
    lengthMin: r.lengthMin,
    facilitator: r.facilitator,
    enabledPhases: r.enabledPhases,
    agenda: r.agenda,
    state: r.state,
    phaseStartedAt: r.phaseStartedAt ?? null,
    phaseDurationSec: r.phaseDurationSec ?? null,
    pausedRemainingSec: r.pausedRemainingSec ?? null,
    adminControlsPhases: r.adminControlsPhases ?? false,
  };
}

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(publicRetroValidator, v.null()),
  handler: async (ctx, { slug }) => {
    const retro = await ctx.db
      .query("retros")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    // Reads only the retro document, so it does not re-run on votes (whether anyone voted comes
    // from ideas.list on the client).
    return retro ? toPublic(retro) : null;
  },
});

/** Summaries for "Your recent retros"; unknown or deleted slugs are left out. */
export const getManyBySlugs = query({
  args: { slugs: v.array(v.string()) },
  returns: v.array(
    v.object({ slug: v.string(), name: v.string(), date: v.string(), facilitator: v.string() }),
  ),
  handler: async (ctx, { slugs }) => {
    if (slugs.length > MAX_RECENT_SLUGS) {
      throw new ConvexError(`At most ${MAX_RECENT_SLUGS} slugs per request.`);
    }
    const found = await Promise.all(
      slugs.map((slug) =>
        ctx.db
          .query("retros")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique(),
      ),
    );
    return found
      .filter((r): r is Doc<"retros"> => r !== null)
      .map((r) => ({ slug: r.slug, name: r.name, date: r.date, facilitator: r.facilitator }));
  },
});

/**
 * Called by the `create` action after validation and hashing. Also opens the creator's admin
 * session (auto-login) in the same transaction. Returns false on a slug collision.
 */
export const insert = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    subtitle: v.string(),
    date: v.string(),
    lengthMin: v.number(),
    facilitator: v.string(),
    enabledPhases: v.array(phaseValidator),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    adminControlsPhases: v.boolean(),
    session: v.optional(v.object({ tokenHash: v.string(), expiresAt: v.number() })),
  },
  returns: v.boolean(),
  handler: async (ctx, { session, ...args }) => {
    const taken = await ctx.db
      .query("retros")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (taken) return false;

    const enabledPhases = orderPhases(args.enabledPhases);
    const retroId = await ctx.db.insert("retros", {
      ...args,
      subtitle: args.subtitle || undefined,
      enabledPhases,
      agenda: calcAgenda(args.lengthMin, enabledPhases),
      state: "not_started",
    });
    if (session) await ctx.db.insert("adminSessions", { retroId, ...session });
    return true;
  },
});
