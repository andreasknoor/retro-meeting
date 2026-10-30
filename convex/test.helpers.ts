// Helpers for convex-test only; not a Convex function module.
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { internal } from "./_generated/api";
import type { Phase } from "./lib/agenda";
import schema from "./schema";

/** convex-test with the components from convex.config.ts registered. */
export function newTest(modules: Record<string, () => Promise<unknown>>): TestConvex<typeof schema> {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

export const ALL_PHASES: Phase[] = ["intro", "brainstorm", "vote", "discuss"];

/** Inserts a retro directly (skips the scrypt action) and returns its slug. */
export async function seedRetro(
  t: TestConvex<typeof schema>,
  overrides: { slug?: string; enabledPhases?: Phase[]; lengthMin?: number; adminControlsPhases?: boolean } = {},
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
    // Most tests drive phases without a session; admin-only control is tested in phase.test.ts.
    adminControlsPhases: overrides.adminControlsPhases ?? false,
  });
  return slug;
}
