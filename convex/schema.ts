import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const phaseValidator = v.union(
  v.literal("intro"),
  v.literal("brainstorm"),
  v.literal("vote"),
  v.literal("discuss"),
);

export const stateValidator = v.union(
  v.literal("not_started"),
  v.literal("intro"),
  v.literal("brainstorm"),
  v.literal("vote"),
  v.literal("discuss"),
  v.literal("finished"),
);

export const columnValidator = v.union(v.literal("keep"), v.literal("fix"), v.literal("try"));

export const agendaValidator = v.object({
  intro: v.number(),
  brainstorm: v.number(),
  vote: v.number(),
  discuss: v.number(),
});

export default defineSchema({
  retros: defineTable({
    slug: v.string(),
    name: v.string(),
    subtitle: v.optional(v.string()),
    date: v.string(), // ISO date, e.g. "2026-10-28"
    lengthMin: v.number(),
    facilitator: v.string(),
    enabledPhases: v.array(phaseValidator),
    agenda: agendaValidator, // minutes per phase
    state: stateValidator,
    phaseStartedAt: v.optional(v.number()),
    phaseDurationSec: v.optional(v.number()),
    // Only the admin may switch phases. Missing on retros created before v0.11 = anyone may.
    adminControlsPhases: v.optional(v.boolean()),
    passwordHash: v.string(),
    passwordSalt: v.string(),
  }).index("by_slug", ["slug"]),

  pulseAnswers: defineTable({
    retroId: v.id("retros"),
    participantId: v.string(),
    score: v.number(), // 1..5
  }).index("by_retroId_and_participantId", ["retroId", "participantId"]),

  ideas: defineTable({
    retroId: v.id("retros"),
    column: columnValidator,
    text: v.string(),
    initials: v.optional(v.string()),
    authorId: v.string(), // participantId; never sent to clients
    // Unused since v0.14 (counts are computed from `votes` to avoid write contention); kept
    // optional so ideas created before stay valid.
    voteCount: v.optional(v.number()),
  })
    .index("by_retroId", ["retroId"])
    .index("by_retroId_and_authorId", ["retroId", "authorId"]),

  votes: defineTable({
    retroId: v.id("retros"),
    ideaId: v.id("ideas"),
    column: columnValidator,
    participantId: v.string(),
  })
    .index("by_retroId_and_participantId_and_column", ["retroId", "participantId", "column"])
    .index("by_ideaId", ["ideaId"]),

  actions: defineTable({
    retroId: v.id("retros"),
    ideaId: v.optional(v.id("ideas")), // set when created with "Make action"
    text: v.string(),
    owner: v.string(),
    dueDate: v.string(), // ISO date; "" = no due date (optional since v1.5)
    // Participant who added it; may delete it (besides the admin). Missing on actions before v1.3.
    authorId: v.optional(v.string()),
  })
    .index("by_retroId", ["retroId"])
    .index("by_ideaId", ["ideaId"]),

  adminSessions: defineTable({
    retroId: v.id("retros"),
    tokenHash: v.string(), // SHA-256 of the cookie token; the token itself is never stored
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_retroId", ["retroId"])
    .index("by_expiresAt", ["expiresAt"]),

  loginAttempts: defineTable({
    retroId: v.id("retros"),
    at: v.number(),
    success: v.boolean(),
  })
    .index("by_retroId_and_at", ["retroId", "at"])
    .index("by_at", ["at"]),
});
