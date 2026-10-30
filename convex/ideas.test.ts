/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { MAX_IDEAS } from "./ideas";
import schema from "./schema";
import { seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";
const BOB = "bob-000000";

async function setup() {
  const t = convexTest(schema, modules);
  const slug = await seedRetro(t);
  const add = (participantId: string, column: "keep" | "fix" | "try", text: string, initials = "") =>
    t.mutation(api.ideas.add, { slug, participantId, column, text, initials });
  return { t, slug, add };
}

describe("ideas.add / list", () => {
  test("lists ideas in creation order with isMine for the caller", async () => {
    const { t, slug, add } = await setup();
    await add(ALICE, "keep", "  Short stand-ups ", " ak ");
    await add(BOB, "fix", "Flaky tests");
    const list = await t.query(api.ideas.list, { slug, participantId: ALICE });
    expect(list.map(({ column, text, initials, isMine, voteCount }) => ({ column, text, initials, isMine, voteCount }))).toEqual([
      { column: "keep", text: "Short stand-ups", initials: "AK", isMine: true, voteCount: 0 },
      { column: "fix", text: "Flaky tests", initials: null, isMine: false, voteCount: 0 },
    ]);
    expect(list[0].createdAt).toBeLessThanOrEqual(list[1].createdAt);
  });

  test("never exposes the author's participant id", async () => {
    const { t, slug, add } = await setup();
    await add(ALICE, "keep", "Idea");
    expect(JSON.stringify(await t.query(api.ideas.list, { slug, participantId: BOB }))).not.toContain(ALICE);
  });

  test.each([
    ["empty text", "   ", "", "The idea is empty."],
    ["long text", "x".repeat(501), "", "An idea can have at most 500 characters."],
    ["long initials", "Idea", "ABCDE", "Initials can have at most 4 characters."],
  ])("rejects %s", async (_, text, initials, message) => {
    const { add } = await setup();
    await expect(add(ALICE, "try", text, initials)).rejects.toThrow(message);
  });

  test("rejects a malformed participant and an unknown retro", async () => {
    const { t, add } = await setup();
    await expect(add("x", "try", "Idea")).rejects.toThrow("Invalid participant.");
    await expect(
      t.mutation(api.ideas.add, { slug: "missing1", participantId: ALICE, column: "try", text: "Idea", initials: "" }),
    ).rejects.toThrow("Retro not found.");
  });

  test(`stops at ${MAX_IDEAS} ideas per retro`, async () => {
    const { t, slug, add } = await setup();
    const retroId = (await t.run((ctx) => ctx.db.query("retros").first()))!._id;
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_IDEAS; i++) {
        await ctx.db.insert("ideas", { retroId, column: "keep", text: `#${i}`, authorId: BOB, voteCount: 0 });
      }
    });
    await expect(add(ALICE, "keep", "One more")).rejects.toThrow("maximum number of ideas");
    expect(await t.query(api.ideas.list, { slug, participantId: ALICE })).toHaveLength(MAX_IDEAS);
  });

  test("returns an empty list for an unknown retro", async () => {
    const { t } = await setup();
    expect(await t.query(api.ideas.list, { slug: "missing1", participantId: ALICE })).toEqual([]);
  });
});

describe("ideas.remove", () => {
  test("the author can delete their idea", async () => {
    const { t, slug, add } = await setup();
    const ideaId = await add(ALICE, "keep", "Mine");
    await t.mutation(api.ideas.remove, { ideaId, participantId: ALICE });
    expect(await t.query(api.ideas.list, { slug, participantId: ALICE })).toEqual([]);
  });

  test("others cannot delete it", async () => {
    const { t, add } = await setup();
    const ideaId = await add(ALICE, "keep", "Mine");
    await expect(t.mutation(api.ideas.remove, { ideaId, participantId: BOB })).rejects.toThrow(
      "Only the author can delete this idea.",
    );
  });

  test("deleting twice is harmless", async () => {
    const { t, add } = await setup();
    const ideaId = await add(ALICE, "keep", "Mine");
    await t.mutation(api.ideas.remove, { ideaId, participantId: ALICE });
    await expect(t.mutation(api.ideas.remove, { ideaId, participantId: ALICE })).resolves.toBeNull();
  });
});
