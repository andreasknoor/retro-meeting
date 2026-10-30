/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Phase } from "./lib/agenda";
import { MAX_ACTIONS } from "./actions";
import schema from "./schema";
import { seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";

async function setup(enabledPhases?: Phase[]) {
  const t = convexTest(schema, modules);
  const slug = await seedRetro(t, { enabledPhases });
  const ideaId = await t.mutation(api.ideas.add, { slug, participantId: ALICE, column: "fix", text: "Flaky tests", initials: "" });
  const goTo = async (target: string) => {
    let state = (await t.query(api.retros.getBySlug, { slug }))!.state;
    while (state !== target) {
      await t.mutation(api.phase.startNext, { slug, from: state });
      state = (await t.query(api.retros.getBySlug, { slug }))!.state;
    }
  };
  const action = { slug, text: "Quarantine flaky tests", owner: "Alex", dueDate: "2026-11-15" };
  return { t, slug, ideaId, goTo, action };
}

describe("actions.add", () => {
  test("free-text actions work in any phase, sorted by due date", async () => {
    const { t, slug, action } = await setup();
    await t.mutation(api.actions.add, { ...action, text: "Later", dueDate: "2026-12-01" });
    await t.mutation(api.actions.add, { ...action, text: " Sooner ", owner: " Sam " });
    expect(
      (await t.query(api.actions.list, { slug })).map(({ text, owner, dueDate, idea }) => ({ text, owner, dueDate, idea })),
    ).toEqual([
      { text: "Sooner", owner: "Sam", dueDate: "2026-11-15", idea: null },
      { text: "Later", owner: "Alex", dueDate: "2026-12-01", idea: null },
    ]);
  });

  test("ideas become actions only during Discuss and are linked both ways", async () => {
    const { t, slug, ideaId, goTo, action } = await setup();
    await goTo("vote");
    await expect(t.mutation(api.actions.add, { ...action, ideaId })).rejects.toThrow(
      "Ideas can only become actions during the Discuss phase.",
    );
    await goTo("discuss");
    await t.mutation(api.actions.add, { ...action, ideaId });
    expect((await t.query(api.actions.list, { slug }))[0].idea).toEqual({ id: ideaId, column: "fix" });
    expect((await t.query(api.ideas.list, { slug, participantId: ALICE }))[0].hasAction).toBe(true);
  });

  test("without a Discuss phase, ideas become actions after the end", async () => {
    const { t, ideaId, goTo, action } = await setup(["brainstorm", "vote"]);
    await goTo("vote");
    await expect(t.mutation(api.actions.add, { ...action, ideaId })).rejects.toThrow("Discuss phase");
    await goTo("finished");
    await expect(t.mutation(api.actions.add, { ...action, ideaId })).resolves.toBeDefined();
  });

  test.each([
    ["no text", { text: "  " }, "Describe the action."],
    ["long text", { text: "x".repeat(201) }, "at most 200 characters"],
    ["no owner", { owner: "" }, "Every action needs an owner."],
    ["long owner", { owner: "x".repeat(61) }, "The owner can have at most 60 characters."],
    ["no date", { dueDate: "" }, "Every action needs a valid due date."],
    ["bad date", { dueDate: "2026-13-01" }, "Every action needs a valid due date."],
  ])("rejects %s", async (_, patch, message) => {
    const { t, action } = await setup();
    await expect(t.mutation(api.actions.add, { ...action, ...patch })).rejects.toThrow(message);
  });

  test("rejects an idea from another retro", async () => {
    const { t, ideaId, goTo, action } = await setup();
    await goTo("discuss");
    const other = await seedRetro(t, { slug: "retro002" });
    await expect(t.mutation(api.actions.add, { ...action, slug: other, ideaId })).rejects.toThrow("This idea was deleted.");
  });

  test(`stops at ${MAX_ACTIONS} actions per retro`, async () => {
    const { t, slug, action } = await setup();
    const retroId = (await t.run((ctx) => ctx.db.query("retros").first()))!._id;
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_ACTIONS; i++) await ctx.db.insert("actions", { retroId, text: `#${i}`, owner: "A", dueDate: "2026-11-01" });
    });
    await expect(t.mutation(api.actions.add, action)).rejects.toThrow("maximum number of actions");
    expect(await t.query(api.actions.list, { slug })).toHaveLength(MAX_ACTIONS);
  });
});

describe("actions.update / remove", () => {
  test("edits and deletes an action", async () => {
    const { t, slug, action } = await setup();
    const actionId = await t.mutation(api.actions.add, action);
    await t.mutation(api.actions.update, { actionId, text: "Fix CI", owner: "Kim", dueDate: "2026-11-20" });
    expect(await t.query(api.actions.list, { slug })).toMatchObject([{ text: "Fix CI", owner: "Kim", dueDate: "2026-11-20" }]);
    await expect(t.mutation(api.actions.update, { actionId, text: "x", owner: "", dueDate: "2026-11-20" })).rejects.toThrow(
      "owner",
    );
    await t.mutation(api.actions.remove, { actionId });
    await t.mutation(api.actions.remove, { actionId });
    expect(await t.query(api.actions.list, { slug })).toEqual([]);
    await expect(
      t.mutation(api.actions.update, { actionId, text: action.text, owner: action.owner, dueDate: action.dueDate }),
    ).rejects.toThrow("This action was deleted.");
  });

  test("deleting the idea keeps the action but drops the link", async () => {
    const { t, slug, ideaId, goTo, action } = await setup();
    await goTo("discuss");
    await t.mutation(api.actions.add, { ...action, ideaId });
    await t.mutation(api.ideas.remove, { ideaId, participantId: ALICE });
    expect(await t.query(api.actions.list, { slug })).toMatchObject([{ text: action.text, idea: null }]);
  });

  test("unknown retro lists nothing", async () => {
    const { t } = await setup();
    expect(await t.query(api.actions.list, { slug: "missing1" })).toEqual([]);
  });
});
