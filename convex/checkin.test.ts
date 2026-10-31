/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const ALICE = "alice-0000";
const BOB = "bob-000000";

async function setup() {
  const t = newTest(modules);
  const slug = await seedRetro(t);
  await t.run(async (ctx) => {
    const retro = (await ctx.db.query("retros").first())!;
    await ctx.db.patch("retros", retro._id, {
      icebreaker: "Coffee or tea?",
      enabledPhases: ["checkin", "intro", "brainstorm", "vote", "discuss"],
      agenda: { checkin: 3, intro: 4, brainstorm: 7, vote: 5, discuss: 11 },
    });
  });
  const answer = (participantId: string, text: string, initials = "") =>
    t.mutation(api.checkin.answer, { slug, participantId, text, initials });
  const list = (participantId = ALICE) => t.query(api.checkin.list, { slug, participantId });
  return { t, slug, answer, list };
}

describe("checkin", () => {
  test("answers only during the Check-in phase", async () => {
    const { t, slug, answer } = await setup();
    await expect(answer(ALICE, "Tea")).rejects.toThrow("Answers are possible during the Check-in phase.");
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await answer(ALICE, "Tea");
    await t.mutation(api.phase.startNext, { slug, from: "checkin" });
    await expect(answer(ALICE, "Coffee")).rejects.toThrow("Answers are possible during the Check-in phase.");
  });

  test("others' answers show once you have answered; one answer per person, changeable", async () => {
    const { t, slug, answer, list } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await answer(BOB, "  Coffee ", " bk ");
    expect(await list()).toEqual({ question: "Coffee or tea?", total: 1, mine: null, revealed: false, answers: [] });

    await answer(ALICE, "Tea");
    await answer(ALICE, "Green tea");
    expect(await list()).toEqual({
      question: "Coffee or tea?",
      total: 2,
      mine: { text: "Green tea", initials: null },
      revealed: true,
      answers: [
        { text: "Coffee", initials: "BK", isMine: false },
        { text: "Green tea", initials: null, isMine: true },
      ],
    });
    expect(JSON.stringify(await list(BOB))).not.toContain(ALICE);
  });

  test("everyone sees the answers once the phase is over", async () => {
    const { t, slug, answer, list } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await answer(BOB, "Coffee");
    await t.mutation(api.phase.startNext, { slug, from: "checkin" });
    expect((await list())!.answers).toEqual([{ text: "Coffee", initials: null, isMine: false }]);
  });

  test("validates the answer", async () => {
    const { t, slug, answer } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await expect(answer(ALICE, " ")).rejects.toThrow("The answer is empty.");
    await expect(answer(ALICE, "x".repeat(141))).rejects.toThrow("at most 140 characters");
    await expect(answer(ALICE, "Hi", "TOOLONG")).rejects.toThrow("Initials can have at most 4 characters.");
    await expect(answer("x", "Hi")).rejects.toThrow("Invalid participant.");
  });

  test("the first phase is Check-in and gets its own time", async () => {
    const { t, slug } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    expect(await t.query(api.retros.getBySlug, { slug })).toMatchObject({ state: "checkin", phaseDurationSec: 180 });
  });
});
