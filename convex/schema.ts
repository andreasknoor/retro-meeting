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
    passwordHash: v.string(),
    passwordSalt: v.string(),
  }).index("by_slug", ["slug"]),

  pulseAnswers: defineTable({
    retroId: v.id("retros"),
    participantId: v.string(),
    score: v.number(), // 1..5
  }).index("by_retroId_and_participantId", ["retroId", "participantId"]),
});
