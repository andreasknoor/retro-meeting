// Helpers for convex-test only; not a Convex function module.
import type { TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import type { Phase } from "./lib/agenda";
import schema from "./schema";

export const ALL_PHASES: Phase[] = ["intro", "brainstorm", "vote", "discuss"];

/** Inserts a retro directly (skips the scrypt action) and returns its slug. */
export async function seedRetro(
  t: TestConvex<typeof schema>,
  overrides: { slug?: string; enabledPhases?: Phase[]; lengthMin?: number } = {},
): Promise<string> {
  const slug = overrides.slug ?? "retro001";
  await t.mutation(internal.retros.insert, {
    slug,
    name: "Test Retro",
    subtitle: "",
    date: "2026-10-28",
    lengthMin: overrides.lengthMin ?? 30,
    facilitator: "Alex",
    enabledPhases: overrides.enabledPhases ?? ALL_PHASES,
    passwordHash: "hash",
    passwordSalt: "salt",
  });
  return slug;
}
