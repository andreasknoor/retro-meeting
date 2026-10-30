/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";
const BOB = "bob-000000";

async function setup({ startVoting = true } = {}) {
  const t = newTest(modules);
  const slug = await seedRetro(t);
  const add = (column: "keep" | "fix" | "try", text: string) =>
    t.mutation(api.ideas.add, { slug, participantId: BOB, column, text, initials: "" });
  const k1 = await add("keep", "K1");
  const k2 = await add("keep", "K2");
  const f1 = await add("fix", "F1");
  if (startVoting) {
    for (const from of ["not_started", "intro", "brainstorm"] as const) {
      await t.mutation(api.phase.startNext, { slug, from });
    }
  }
  const toggle = (ideaId: Id<"ideas">, participantId = ALICE) => t.mutation(api.votes.toggle, { ideaId, participantId });
  const view = async (participantId = ALICE) =>
    Object.fromEntries(
      (await t.query(api.ideas.list, { slug, participantId })).map((i) => [i.text, [i.voteCount, i.votedByMe]]),
    );
  return { t, slug, k1, k2, f1, toggle, view };
}

describe("votes.toggle", () => {
  test("casts one vote per column", async () => {
    const { k1, f1, toggle, view } = await setup();
    expect(await toggle(k1)).toBe("cast");
    expect(await toggle(f1)).toBe("cast");
    expect(await view()).toEqual({ K1: [1, true], K2: [0, false], F1: [1, true] });
    expect(await view(BOB)).toEqual({ K1: [1, false], K2: [0, false], F1: [1, false] });
  });

  test("voting for another idea in the same column moves the vote", async () => {
    const { k1, k2, toggle, view } = await setup();
    await toggle(k1);
    expect(await toggle(k2)).toBe("moved");
    expect(await view()).toMatchObject({ K1: [0, false], K2: [1, true] });
  });

  test("voting again takes the vote back", async () => {
    const { k1, toggle, view } = await setup();
    await toggle(k1);
    expect(await toggle(k1)).toBe("retracted");
    expect(await view()).toMatchObject({ K1: [0, false] });
  });

  test("you may vote for your own idea", async () => {
    const { k1, toggle, view } = await setup();
    await toggle(k1, BOB);
    expect(await view(BOB)).toMatchObject({ K1: [1, true] });
  });

  test("only during the Vote phase", async () => {
    const { k1, toggle } = await setup({ startVoting: false });
    await expect(toggle(k1)).rejects.toThrow("Voting is only possible during the Vote phase.");
  });

  test("rejects deleted ideas and malformed participants", async () => {
    const { t, k1, toggle } = await setup();
    await expect(toggle(k1, "x")).rejects.toThrow("Invalid participant.");
    await t.mutation(api.ideas.remove, { ideaId: k1, participantId: BOB });
    await expect(toggle(k1)).rejects.toThrow("This idea was deleted.");
  });

  test("20 people voting at once produce exact counts", async () => {
    const { k1, k2, toggle, view } = await setup();
    const people = Array.from({ length: 20 }, (_, i) => `person-${String(i).padStart(4, "0")}`);
    await Promise.all(people.map((p, i) => toggle(i % 4 === 0 ? k2 : k1, p)));
    expect(await view()).toMatchObject({ K1: [15, false], K2: [5, false] });
    // Everyone switches to the other idea at the same time.
    await Promise.all(people.map((p, i) => toggle(i % 4 === 0 ? k1 : k2, p)));
    expect(await view()).toMatchObject({ K1: [5, false], K2: [15, false] });
  });

  test("deleting an idea removes its votes, so the voter can vote again", async () => {
    const { t, k1, k2, toggle, view } = await setup();
    await toggle(k1);
    await t.mutation(api.ideas.remove, { ideaId: k1, participantId: BOB });
    expect(await t.run((ctx) => ctx.db.query("votes").collect())).toEqual([]);
    expect(await toggle(k2)).toBe("cast");
    expect(await view()).toMatchObject({ K2: [1, true] });
  });
});

describe("votes.voterCount", () => {
  test("counts people, not votes", async () => {
    const { t, slug, k1, f1, toggle } = await setup();
    expect(await t.query(api.votes.voterCount, { slug })).toBe(0);
    await toggle(k1);
    await toggle(f1);
    expect(await t.query(api.votes.voterCount, { slug })).toBe(1);
    await toggle(k1, BOB);
    expect(await t.query(api.votes.voterCount, { slug })).toBe(2);
    expect(await t.query(api.votes.voterCount, { slug: "missing1" })).toBe(0);
  });
});
