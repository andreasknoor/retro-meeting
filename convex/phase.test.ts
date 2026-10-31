/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const T0 = new Date("2026-10-28T10:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function setup(enabledPhases?: ("intro" | "brainstorm" | "vote" | "discuss")[]) {
  const t = newTest(modules);
  const slug = await seedRetro(t, { enabledPhases });
  const get = async () => (await t.query(api.retros.getBySlug, { slug }))!;
  return { t, slug, get };
}

describe("phase.startNext", () => {
  test("starts the first phase with its planned duration", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    expect(await get()).toMatchObject({ state: "intro", phaseStartedAt: T0, phaseDurationSec: 4 * 60 });
  });

  test("walks through all phases to finished and stops there", async () => {
    const { t, slug, get } = await setup();
    for (const from of ["not_started", "intro", "brainstorm", "vote", "discuss"] as const) {
      await t.mutation(api.phase.startNext, { slug, from });
    }
    expect(await get()).toMatchObject({ state: "finished", phaseStartedAt: null, phaseDurationSec: null });
    await t.mutation(api.phase.startNext, { slug, from: "finished" });
    expect((await get()).state).toBe("finished");
  });

  test("skips disabled phases", async () => {
    const { t, slug, get } = await setup(["brainstorm", "discuss"]);
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.startNext, { slug, from: "brainstorm" });
    expect((await get()).state).toBe("discuss");
  });

  test("ignores a stale click when someone else already switched", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    expect((await get()).state).toBe("intro");
  });

  test("fails for an unknown retro", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.phase.startNext, { slug: "missing1", from: "not_started" })).rejects.toThrow(
      "Retro not found.",
    );
  });
});

describe("phase.back", () => {
  test("goes one phase back and restarts it with its full duration", async () => {
    const { t, slug, get } = await setup();
    for (const from of ["not_started", "intro", "brainstorm", "vote"] as const) {
      await t.mutation(api.phase.startNext, { slug, from });
    }
    vi.setSystemTime(T0 + 60_000);
    await t.mutation(api.phase.back, { slug, from: "discuss" });
    expect(await get()).toMatchObject({ state: "vote", phaseStartedAt: T0 + 60_000, phaseDurationSec: 5 * 60 });
  });

  test("from finished back to the last phase; skips disabled phases", async () => {
    const { t, slug, get } = await setup(["brainstorm", "discuss"]);
    for (const from of ["not_started", "brainstorm", "discuss"] as const) await t.mutation(api.phase.startNext, { slug, from });
    await t.mutation(api.phase.back, { slug, from: "finished" });
    expect((await get()).state).toBe("discuss");
    await t.mutation(api.phase.back, { slug, from: "discuss" });
    expect((await get()).state).toBe("brainstorm");
  });

  test("does nothing in the first phase, before the start, or with a stale state", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.back, { slug, from: "not_started" });
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.back, { slug, from: "intro" });
    await t.mutation(api.phase.back, { slug, from: "vote" });
    expect((await get()).state).toBe("intro");
  });

  test("going back before Vote deletes all votes, but only when confirmed", async () => {
    const { t, slug, get } = await setup();
    const add = (text: string) => t.mutation(api.ideas.add, { slug, participantId: "alice-0000", column: "keep", text, initials: "" });
    const k1 = await add("K1");
    const k2 = await add("K2");
    for (const from of ["not_started", "intro", "brainstorm"] as const) await t.mutation(api.phase.startNext, { slug, from });
    await t.mutation(api.votes.toggle, { ideaId: k1, participantId: "alice-0000" });
    await t.mutation(api.votes.toggle, { ideaId: k2, participantId: "bob-000000" });
    expect(await t.query(api.votes.voterCount, { slug })).toBe(2);

    await expect(t.mutation(api.phase.back, { slug, from: "vote" })).rejects.toThrow("Going back deletes all votes.");
    expect((await get()).state).toBe("vote");

    await t.mutation(api.phase.back, { slug, from: "vote", discardVotes: true });
    expect((await get()).state).toBe("brainstorm");
    expect(await t.query(api.votes.voterCount, { slug })).toBe(0);
  });

  test("going back before Vote without any votes needs no confirmation", async () => {
    const { t, slug, get } = await setup();
    for (const from of ["not_started", "intro", "brainstorm"] as const) await t.mutation(api.phase.startNext, { slug, from });
    await t.mutation(api.phase.back, { slug, from: "vote" });
    expect((await get()).state).toBe("brainstorm");
  });

  test("keeps votes and reopens voting when going back to Vote", async () => {
    const { t, slug, get } = await setup();
    const ideaId = await t.mutation(api.ideas.add, { slug, participantId: "alice-0000", column: "keep", text: "K", initials: "" });
    for (const from of ["not_started", "intro", "brainstorm"] as const) await t.mutation(api.phase.startNext, { slug, from });
    await t.mutation(api.votes.toggle, { ideaId, participantId: "alice-0000" });
    await t.mutation(api.phase.startNext, { slug, from: "vote" });
    await t.mutation(api.phase.back, { slug, from: "discuss" });
    expect((await get()).state).toBe("vote");
    expect(await t.mutation(api.votes.toggle, { ideaId, participantId: "alice-0000" })).toBe("retracted");
  });
});

describe("phase.extend / pause / resume / reset", () => {
  test("+1 min extends the running phase", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.extend, { slug, from: "intro" });
    expect((await get()).phaseDurationSec).toBe(5 * 60);
  });

  test("+1 min does nothing before the start, after the end or with a stale state", async () => {
    const { t, slug, get } = await setup(["intro"]);
    await t.mutation(api.phase.extend, { slug, from: "not_started" });
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    const planned = (await get()).phaseDurationSec;
    await t.mutation(api.phase.extend, { slug, from: "vote" });
    expect((await get()).phaseDurationSec).toBe(planned);
    await t.mutation(api.phase.startNext, { slug, from: "intro" });
    await t.mutation(api.phase.extend, { slug, from: "finished" });
    expect(await get()).toMatchObject({ state: "finished", phaseDurationSec: null, pausedRemainingSec: null });
  });

  test("pause keeps the remaining time, resume continues from it, +1 min works while paused", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    vi.advanceTimersByTime(60_500);
    await t.mutation(api.phase.pause, { slug, from: "intro" });
    expect(await get()).toMatchObject({ state: "intro", phaseStartedAt: null, phaseDurationSec: null, pausedRemainingSec: 180 });
    await t.mutation(api.phase.pause, { slug, from: "intro" });
    expect((await get()).pausedRemainingSec).toBe(180);

    vi.advanceTimersByTime(10 * 60_000);
    await t.mutation(api.phase.extend, { slug, from: "intro" });
    await t.mutation(api.phase.resume, { slug, from: "intro" });
    expect(await get()).toMatchObject({ phaseStartedAt: expect.any(Number), phaseDurationSec: 240, pausedRemainingSec: null });
    await t.mutation(api.phase.resume, { slug, from: "intro" });
    expect((await get()).phaseDurationSec).toBe(240);
  });

  test("pausing in overtime keeps the negative remainder", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    vi.advanceTimersByTime(5 * 60_000);
    await t.mutation(api.phase.pause, { slug, from: "intro" });
    expect((await get()).pausedRemainingSec).toBe(-60);
  });

  test("a timer stopped by the old End early resumes at 0:00", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.run(async (ctx) => {
      const retro = (await ctx.db.query("retros").first())!;
      await ctx.db.patch("retros", retro._id, { phaseStartedAt: undefined, phaseDurationSec: undefined });
    });
    await t.mutation(api.phase.resume, { slug, from: "intro" });
    expect(await get()).toMatchObject({ phaseStartedAt: expect.any(Number), phaseDurationSec: 0 });
  });

  test("starting the next phase clears a pause", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.pause, { slug, from: "intro" });
    await t.mutation(api.phase.startNext, { slug, from: "intro" });
    expect(await get()).toMatchObject({ state: "brainstorm", phaseDurationSec: 8 * 60, pausedRemainingSec: null });
  });

  test("reset goes back to not started and ignores a stale click", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.reset, { slug, from: "not_started" });
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.reset, { slug, from: "brainstorm" });
    expect((await get()).state).toBe("intro");
    await t.mutation(api.phase.reset, { slug, from: "intro" });
    expect(await get()).toMatchObject({ state: "not_started", phaseStartedAt: null, phaseDurationSec: null });
  });

  test("reset deletes votes only when confirmed and keeps everything else", async () => {
    const { t, slug, get } = await setup();
    const ideaId = await t.mutation(api.ideas.add, { slug, participantId: "alice-0000", column: "keep", text: "K", initials: "" });
    await t.mutation(api.pulse.answer, { slug, participantId: "alice-0000", score: 4 });
    for (const from of ["not_started", "intro", "brainstorm"] as const) await t.mutation(api.phase.startNext, { slug, from });
    await t.mutation(api.votes.toggle, { ideaId, participantId: "alice-0000" });
    await t.mutation(api.phase.startNext, { slug, from: "vote" });

    await expect(t.mutation(api.phase.reset, { slug, from: "discuss" })).rejects.toThrow("Reset deletes all votes.");
    expect((await get()).state).toBe("discuss");
    await t.mutation(api.phase.reset, { slug, from: "discuss", discardVotes: true });
    expect((await get()).state).toBe("not_started");
    expect(await t.query(api.votes.voterCount, { slug })).toBe(0);
    expect(await t.query(api.ideas.list, { slug, participantId: "alice-0000" })).toHaveLength(1);
    expect((await t.query(api.pulse.summary, { slug, participantId: "alice-0000" }))!.total).toBe(1);
  });
});

describe("admin-only phase control", () => {
  test("rejects participants without an admin session", async () => {
    const { t, slug } = await setup();
    await t.run(async (ctx) => {
      const retro = (await ctx.db.query("retros").first())!;
      await ctx.db.patch("retros", retro._id, { adminControlsPhases: true });
    });
    for (const call of [
      () => t.mutation(api.phase.startNext, { slug, from: "not_started" }),
      () => t.mutation(api.phase.startNext, { slug, from: "not_started", token: "forged" }),
      () => t.mutation(api.phase.extend, { slug, from: "not_started" }),
      () => t.mutation(api.phase.back, { slug, from: "not_started" }),
      () => t.mutation(api.phase.pause, { slug, from: "not_started" }),
      () => t.mutation(api.phase.resume, { slug, from: "not_started" }),
      () => t.mutation(api.phase.reset, { slug, from: "not_started" }),
    ]) {
      await expect(call()).rejects.toThrow("Only the admin can switch phases.");
    }
  });

  test("the admin session from creating the retro can switch", async () => {
    vi.useRealTimers();
    const t = newTest(modules);
    const { slug, token } = await t.action(api.retrosNode.create, {
      name: "R", subtitle: "", date: "2026-10-28", lengthMin: 30, facilitator: "F",
      enabledPhases: ["intro", "brainstorm"], password: "secret1",
    });
    await t.mutation(api.phase.startNext, { slug, from: "not_started", token });
    await t.mutation(api.phase.startNext, { slug, from: "intro", token });
    await t.mutation(api.phase.back, { slug, from: "brainstorm", token });
    await t.mutation(api.phase.extend, { slug, from: "intro", token });
    await t.mutation(api.phase.pause, { slug, from: "intro", token });
    await t.mutation(api.phase.resume, { slug, from: "intro", token });
    await t.mutation(api.phase.reset, { slug, from: "intro", token });
    expect((await t.query(api.retros.getBySlug, { slug }))!.state).toBe("not_started");
  });
});

test("clock.now returns the server time", async () => {
  const t = newTest(modules);
  expect(await t.action(api.clock.now, {})).toBe(T0);
});
