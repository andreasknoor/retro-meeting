import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { deleteIdea } from "./ideas";
import { orderPhases } from "./lib/agenda";
import { adminRetro, LOCKOUT_WINDOW_MS, MAX_FAILED_ATTEMPTS, requireAdmin, sha256Hex } from "./lib/adminAuth";
import { findRetro } from "./lib/retroAccess";
import { agendaValidator } from "./schema";

// Login (see adminNode.ts) ------------------------------------------------------------------

/**
 * Records a login attempt as failed up front and returns what the action needs to verify the
 * password. Counting and recording happen in one transaction, so parallel attempts cannot
 * slip past the lockout. A successful login marks the attempt as success (finishLogin).
 */
export const beginAttempt = internalMutation({
  args: { slug: v.string() },
  returns: v.object({
    attemptId: v.id("loginAttempts"),
    retroId: v.id("retros"),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    attemptsLeft: v.number(),
  }),
  handler: async (ctx, { slug }) => {
    const retro = await findRetro(ctx, slug);
    if (!retro) throw new ConvexError("Retro not found.");
    const now = Date.now();
    const recent = await ctx.db
      .query("loginAttempts")
      .withIndex("by_retroId_and_at", (q) => q.eq("retroId", retro._id).gt("at", now - LOCKOUT_WINDOW_MS))
      .order("desc")
      .take(50);
    const failures = recent.filter((a) => !a.success);
    if (failures.length >= MAX_FAILED_ATTEMPTS) {
      // Unlocks when the oldest of the last MAX_FAILED_ATTEMPTS failures leaves the window.
      const unlockAt = failures[MAX_FAILED_ATTEMPTS - 1].at + LOCKOUT_WINDOW_MS;
      const minutes = Math.max(1, Math.ceil((unlockAt - now) / 60_000));
      throw new ConvexError(`Too many failed attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`);
    }
    const attemptId = await ctx.db.insert("loginAttempts", { retroId: retro._id, at: now, success: false });
    return {
      attemptId,
      retroId: retro._id,
      passwordHash: retro.passwordHash,
      passwordSalt: retro.passwordSalt,
      attemptsLeft: MAX_FAILED_ATTEMPTS - failures.length - 1,
    };
  },
});

export const finishLogin = internalMutation({
  args: { attemptId: v.id("loginAttempts"), retroId: v.id("retros"), tokenHash: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { attemptId, retroId, tokenHash, expiresAt }) => {
    await ctx.db.patch("loginAttempts", attemptId, { success: true });
    await ctx.db.insert("adminSessions", { retroId, tokenHash, expiresAt });
    return null;
  },
});

// Session ------------------------------------------------------------------------------------

/** `now` comes from the Next.js server (queries must not read the clock). */
export const validate = query({
  args: { slug: v.string(), token: v.string(), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { slug, token, now }) => (await adminRetro(ctx, slug, token, now)) !== null,
});

export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) await ctx.db.delete("adminSessions", session._id);
    return null;
  },
});

// Admin operations ---------------------------------------------------------------------------

export const MAX_PHASE_MINUTES = 120;

/** Only the durations can change (§4.9); disabled phases stay at 0. */
export const updateAgenda = mutation({
  args: { slug: v.string(), token: v.string(), agenda: agendaValidator },
  returns: v.null(),
  handler: async (ctx, { slug, token, agenda }) => {
    const retro = await requireAdmin(ctx, slug, token, Date.now());
    const next = { intro: 0, brainstorm: 0, vote: 0, discuss: 0 };
    for (const phase of orderPhases(retro.enabledPhases)) {
      const minutes = agenda[phase];
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_PHASE_MINUTES) {
        throw new ConvexError(`Each phase needs between 1 and ${MAX_PHASE_MINUTES} whole minutes.`);
      }
      next[phase] = minutes;
    }
    await ctx.db.patch("retros", retro._id, { agenda: next });
    return null;
  },
});

export const updateSettings = mutation({
  args: { slug: v.string(), token: v.string(), adminControlsPhases: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { slug, token, adminControlsPhases }) => {
    const retro = await requireAdmin(ctx, slug, token, Date.now());
    await ctx.db.patch("retros", retro._id, { adminControlsPhases });
    return null;
  },
});

/** Admins may delete any idea (§4.9). */
export const removeIdea = mutation({
  args: { slug: v.string(), token: v.string(), ideaId: v.id("ideas") },
  returns: v.null(),
  handler: async (ctx, { slug, token, ideaId }) => {
    const retro = await requireAdmin(ctx, slug, token, Date.now());
    const idea = await ctx.db.get("ideas", ideaId);
    if (idea && idea.retroId === retro._id) await deleteIdea(ctx, ideaId);
    return null;
  },
});

/** Admins may delete any action. */
export const removeAction = mutation({
  args: { slug: v.string(), token: v.string(), actionId: v.id("actions") },
  returns: v.null(),
  handler: async (ctx, { slug, token, actionId }) => {
    const retro = await requireAdmin(ctx, slug, token, Date.now());
    const action = await ctx.db.get("actions", actionId);
    if (action && action.retroId === retro._id) await ctx.db.delete("actions", actionId);
    return null;
  },
});

/**
 * Deletes the retro. The retro document goes first, so every open page switches to
 * "not found" at once; the rest is purged in batches in the background.
 */
export const deleteRetro = mutation({
  args: { slug: v.string(), token: v.string(), confirmName: v.string() },
  returns: v.null(),
  handler: async (ctx, { slug, token, confirmName }) => {
    const retro = await requireAdmin(ctx, slug, token, Date.now());
    if (confirmName !== retro.name) throw new ConvexError("Type the retro name exactly to confirm.");
    await ctx.db.delete("retros", retro._id);
    await ctx.scheduler.runAfter(0, internal.admin.purgeRetroData, { retroId: retro._id });
    return null;
  },
});

const PURGE_BATCH = 200;

export const purgeRetroData = internalMutation({
  args: { retroId: v.id("retros") },
  returns: v.null(),
  handler: async (ctx, { retroId }) => {
    const batches: { _id: Id<"pulseAnswers" | "ideas" | "votes" | "actions" | "adminSessions" | "loginAttempts"> }[][] = [
      await ctx.db.query("votes").withIndex("by_retroId_and_participantId_and_column", (q) => q.eq("retroId", retroId)).take(PURGE_BATCH),
      await ctx.db.query("actions").withIndex("by_retroId", (q) => q.eq("retroId", retroId)).take(PURGE_BATCH),
      await ctx.db.query("ideas").withIndex("by_retroId", (q) => q.eq("retroId", retroId)).take(PURGE_BATCH),
      await ctx.db.query("pulseAnswers").withIndex("by_retroId_and_participantId", (q) => q.eq("retroId", retroId)).take(PURGE_BATCH),
      await ctx.db.query("adminSessions").withIndex("by_retroId", (q) => q.eq("retroId", retroId)).take(PURGE_BATCH),
      await ctx.db.query("loginAttempts").withIndex("by_retroId_and_at", (q) => q.eq("retroId", retroId)).take(PURGE_BATCH),
    ];
    let deleted = 0;
    for (const batch of batches) {
      for (const doc of batch) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
    }
    if (deleted > 0) await ctx.scheduler.runAfter(0, internal.admin.purgeRetroData, { retroId });
    return null;
  },
});

// Housekeeping (crons.ts) ---------------------------------------------------------------------

export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db.query("adminSessions").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(500);
    for (const s of sessions) await ctx.db.delete("adminSessions", s._id);
    const attempts = await ctx.db.query("loginAttempts").withIndex("by_at", (q) => q.lt("at", now - 24 * 60 * 60 * 1000)).take(500);
    for (const a of attempts) await ctx.db.delete("loginAttempts", a._id);
    if (sessions.length === 500 || attempts.length === 500) {
      await ctx.scheduler.runAfter(0, internal.admin.purgeExpired, {});
    }
    return null;
  },
});
