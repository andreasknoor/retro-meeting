/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";
const BOB = "bob-000000";

async function setup(enabledPhases?: ("intro" | "brainstorm" | "vote" | "discuss")[]) {
  const t = convexTest(schema, modules);
  const slug = await seedRetro(t, { enabledPhases });
  return { t, slug };
}

describe("pulse", () => {
  test("aggregates answers and marks the caller's own", async () => {
    const { t, slug } = await setup();
    await t.mutation(api.pulse.answer, { slug, participantId: ALICE, score: 4 });
    await t.mutation(api.pulse.answer, { slug, participantId: BOB, score: 3 });
    expect(await t.query(api.pulse.summary, { slug, participantId: ALICE })).toEqual({
      counts: [0, 0, 1, 1, 0],
      total: 2,
      average: 3.5,
      mine: 4,
    });
    expect((await t.query(api.pulse.summary, { slug, participantId: "carol-0000" }))!.mine).toBeNull();
  });

  test("changing an answer does not double-count", async () => {
    const { t, slug } = await setup();
    await t.mutation(api.pulse.answer, { slug, participantId: ALICE, score: 2 });
    await t.mutation(api.pulse.answer, { slug, participantId: ALICE, score: 5 });
    expect(await t.query(api.pulse.summary, { slug, participantId: ALICE })).toMatchObject({
      counts: [0, 0, 0, 0, 1],
      total: 1,
      mine: 5,
    });
  });

  test("never reveals who answered what", async () => {
    const { t, slug } = await setup();
    await t.mutation(api.pulse.answer, { slug, participantId: ALICE, score: 2 });
    const json = JSON.stringify(await t.query(api.pulse.summary, { slug, participantId: BOB }));
    expect(json).not.toContain(ALICE);
  });

  test.each([0, 6, 2.5])("rejects score %s", async (score) => {
    const { t, slug } = await setup();
    await expect(t.mutation(api.pulse.answer, { slug, participantId: ALICE, score })).rejects.toThrow(
      "Score must be 1 to 5.",
    );
  });

  test("rejects a malformed participant id", async () => {
    const { t, slug } = await setup();
    await expect(t.mutation(api.pulse.answer, { slug, participantId: "x", score: 3 })).rejects.toThrow(
      "Invalid participant.",
    );
  });

  test("is unavailable when the intro phase is disabled", async () => {
    const { t, slug } = await setup(["brainstorm", "vote", "discuss"]);
    await expect(t.mutation(api.pulse.answer, { slug, participantId: ALICE, score: 3 })).rejects.toThrow(
      "This retro has no pulse check.",
    );
  });

  test("returns null for an unknown retro", async () => {
    const { t } = await setup();
    expect(await t.query(api.pulse.summary, { slug: "missing1", participantId: ALICE })).toBeNull();
  });
});
