/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Phase } from "./lib/agenda";
import { MAX_ACTIONS, MAX_ACTIONS_PER_PARTICIPANT } from "./actions";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";
const BOB = "bob-000000";

async function setup(enabledPhases?: Phase[]) {
  const t = newTest(modules);
  const slug = await seedRetro(t, { enabledPhases });
  const ideaId = await t.mutation(api.ideas.add, { slug, participantId: ALICE, column: "fix", text: "Flaky tests", initials: "" });
  const goTo = async (target: string) => {
    let state = (await t.query(api.retros.getBySlug, { slug }))!.state;
    while (state !== target) {
      await t.mutation(api.phase.startNext, { slug, from: state });
      state = (await t.query(api.retros.getBySlug, { slug }))!.state;
    }
  };
  const action = { slug, participantId: ALICE, text: "Quarantine flaky tests", owner: "Alex", dueDate: "2099-11-15" };
  return { t, slug, ideaId, goTo, action };
}

describe("actions.add", () => {
  test("free-text actions work in any phase, sorted by due date", async () => {
    const { t, slug, action } = await setup();
    await t.mutation(api.actions.add, { ...action, text: "Later", dueDate: "2099-12-01" });
    await t.mutation(api.actions.add, { ...action, text: " Sooner ", owner: " Sam " });
    expect(
      (await t.query(api.actions.list, { slug, participantId: ALICE })).map(({ text, owner, dueDate, idea }) => ({ text, owner, dueDate, idea })),
    ).toEqual([
      { text: "Sooner", owner: "Sam", dueDate: "2099-11-15", idea: null },
      { text: "Later", owner: "Alex", dueDate: "2099-12-01", idea: null },
    ]);
  });

  test("ideas become actions only during Discuss and are linked both ways", async () => {
    const { t, slug, ideaId, goTo, action } = await setup();
    await goTo("vote");
    await expect(t.mutation(api.actions.add, { ...action, ideaId })).rejects.toThrow(
      "Ideas can only become actions during the Discuss & Act phase.",
    );
    await goTo("discuss");
    await t.mutation(api.actions.add, { ...action, ideaId });
    expect((await t.query(api.actions.list, { slug, participantId: ALICE }))[0].idea).toEqual({ id: ideaId, column: "fix" });
    expect((await t.query(api.ideas.list, { slug, participantId: ALICE }))[0].hasAction).toBe(true);
  });

  test("without a Discuss phase, ideas become actions after the end", async () => {
    const { t, ideaId, goTo, action } = await setup(["brainstorm", "vote"]);
    await goTo("vote");
    await expect(t.mutation(api.actions.add, { ...action, ideaId })).rejects.toThrow("Discuss & Act phase");
    await goTo("finished");
    await expect(t.mutation(api.actions.add, { ...action, ideaId })).resolves.toBeDefined();
  });

  test.each([
    ["no text", { text: "  " }, "Describe the action."],
    ["long text", { text: "x".repeat(201) }, "at most 200 characters"],
    ["no owner", { owner: "" }, "Every action needs an owner."],
    ["long owner", { owner: "x".repeat(61) }, "The owner can have at most 60 characters."],
    ["bad date", { dueDate: "2026-13-01" }, "The due date is invalid."],
    ["past date", { dueDate: "2020-01-01" }, "The due date is in the past."],
  ])("rejects %s", async (_, patch, message) => {
    const { t, action } = await setup();
    await expect(t.mutation(api.actions.add, { ...action, ...patch })).rejects.toThrow(message);
  });

  test("the due date is optional; actions without one come last", async () => {
    const { t, slug, action } = await setup();
    await t.mutation(api.actions.add, { ...action, text: "Someday", dueDate: "" });
    await t.mutation(api.actions.add, action);
    expect((await t.query(api.actions.list, { slug, participantId: ALICE })).map((a) => [a.text, a.dueDate])).toEqual([
      [action.text, action.dueDate],
      ["Someday", ""],
    ]);
  });

  test("rejects an idea from another retro", async () => {
    const { t, ideaId, goTo, action } = await setup();
    await goTo("discuss");
    const other = await seedRetro(t, { slug: "retro002" });
    await expect(t.mutation(api.actions.add, { ...action, slug: other, ideaId })).rejects.toThrow("This idea was deleted.");
  });

  test(`limits each participant to ${MAX_ACTIONS_PER_PARTICIPANT} actions`, async () => {
    const { t, action } = await setup();
    const retroId = (await t.run((ctx) => ctx.db.query("retros").first()))!._id;
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_ACTIONS_PER_PARTICIPANT; i++)
        await ctx.db.insert("actions", { retroId, authorId: ALICE, text: `#${i}`, owner: "A", dueDate: "2099-11-01" });
    });
    await expect(t.mutation(api.actions.add, action)).rejects.toThrow(`at most ${MAX_ACTIONS_PER_PARTICIPANT} actions`);
    await t.mutation(api.actions.add, { ...action, participantId: BOB });
  });

  test(`lists at most ${MAX_ACTIONS} actions`, async () => {
    const { t, slug } = await setup();
    const retroId = (await t.run((ctx) => ctx.db.query("retros").first()))!._id;
    await t.run(async (ctx) => {
      for (let i = 0; i < MAX_ACTIONS + 5; i++) await ctx.db.insert("actions", { retroId, text: `#${i}`, owner: "A", dueDate: "2099-11-01" });
    });
    expect(await t.query(api.actions.list, { slug, participantId: ALICE })).toHaveLength(MAX_ACTIONS);
  });
});

describe("actions.update / remove", () => {
  test("edits and deletes an action", async () => {
    const { t, slug, action } = await setup();
    const actionId = await t.mutation(api.actions.add, action);
    await t.mutation(api.actions.update, { actionId, text: "Fix CI", owner: "Kim", dueDate: "2099-11-20" });
    expect(await t.query(api.actions.list, { slug, participantId: ALICE })).toMatchObject([{ text: "Fix CI", owner: "Kim", dueDate: "2099-11-20" }]);
    await expect(t.mutation(api.actions.update, { actionId, text: "x", owner: "", dueDate: "2099-11-20" })).rejects.toThrow(
      "owner",
    );
    await t.mutation(api.actions.remove, { actionId, participantId: ALICE });
    await t.mutation(api.actions.remove, { actionId, participantId: ALICE });
    expect(await t.query(api.actions.list, { slug, participantId: ALICE })).toEqual([]);
    await expect(
      t.mutation(api.actions.update, { actionId, text: action.text, owner: action.owner, dueDate: action.dueDate }),
    ).rejects.toThrow("This action was deleted.");
  });

  test("anyone may edit, but only the author deletes; actions from before v1.3 only the admin", async () => {
    const { t, slug, action } = await setup();
    const actionId = await t.mutation(api.actions.add, action);
    expect((await t.query(api.actions.list, { slug, participantId: ALICE }))[0].isMine).toBe(true);
    expect((await t.query(api.actions.list, { slug, participantId: BOB }))[0].isMine).toBe(false);
    await t.mutation(api.actions.update, { actionId, text: "Edited by Bob", owner: "Bob", dueDate: "2099-11-20" });
    await expect(t.mutation(api.actions.remove, { actionId, participantId: BOB })).rejects.toThrow(
      "Only the person who added this action or the admin can delete it.",
    );
    const retroId = (await t.run((ctx) => ctx.db.query("retros").first()))!._id;
    const legacy = await t.run((ctx) => ctx.db.insert("actions", { retroId, text: "Old", owner: "A", dueDate: "2099-11-01" }));
    await expect(t.mutation(api.actions.remove, { actionId: legacy, participantId: ALICE })).rejects.toThrow("admin");
  });

  test("never exposes the author's participant id", async () => {
    const { t, slug, action } = await setup();
    await t.mutation(api.actions.add, action);
    expect(JSON.stringify(await t.query(api.actions.list, { slug, participantId: BOB }))).not.toContain(ALICE);
  });

  test("an overdue action can still be edited, but not moved to another past date", async () => {
    const { t, slug } = await setup();
    const retroId = (await t.run((ctx) => ctx.db.query("retros").first()))!._id;
    const actionId = await t.run((ctx) => ctx.db.insert("actions", { retroId, text: "Old", owner: "A", dueDate: "2020-01-01" }));
    await t.mutation(api.actions.update, { actionId, text: "Old", owner: "Kim", dueDate: "2020-01-01" });
    expect((await t.query(api.actions.list, { slug, participantId: ALICE }))[0].owner).toBe("Kim");
    await expect(t.mutation(api.actions.update, { actionId, text: "Old", owner: "Kim", dueDate: "2020-01-02" })).rejects.toThrow(
      "The due date is in the past.",
    );
  });

  test("rejects a malformed participant", async () => {
    const { t, action } = await setup();
    await expect(t.mutation(api.actions.add, { ...action, participantId: "x" })).rejects.toThrow("Invalid participant.");
  });

  test("deleting the idea keeps the action but drops the link", async () => {
    const { t, slug, ideaId, goTo, action } = await setup();
    await goTo("discuss");
    await t.mutation(api.actions.add, { ...action, ideaId });
    await t.mutation(api.ideas.remove, { ideaId, participantId: ALICE });
    expect(await t.query(api.actions.list, { slug, participantId: ALICE })).toMatchObject([{ text: action.text, idea: null }]);
  });

  test("unknown retro lists nothing", async () => {
    const { t } = await setup();
    expect(await t.query(api.actions.list, { slug: "missing1", participantId: ALICE })).toEqual([]);
  });
});
