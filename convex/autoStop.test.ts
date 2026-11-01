/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { newTest, seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const T0 = new Date("2026-11-01T10:00:00Z").getTime();
const MIN = 60 * 1000;
const ALICE = "alice-0000";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

/** A retro in its 8-minute Brainstorm phase, started at T0. */
async function setup() {
  const t = newTest(modules);
  const slug = await seedRetro(t);
  await t.mutation(api.phase.startNext, { slug, from: "not_started" });
  await t.mutation(api.phase.startNext, { slug, from: "intro" });
  const get = async () => (await t.query(api.retros.getBySlug, { slug }))!;
  const at = async (minutes: number) => {
    vi.setSystemTime(T0 + minutes * MIN);
    await t.mutation(internal.autoStop.run, {});
    return get();
  };
  return { t, slug, get, at };
}

describe("autoStop.run", () => {
  test("pauses a phase an hour into overtime with nothing happening, keeping the overtime", async () => {
    const { at } = await setup();
    expect(await at(67)).toMatchObject({ state: "brainstorm", autoStopped: null, phaseStartedAt: expect.any(Number) });
    const paused = await at(69);
    expect(paused).toMatchObject({ state: "brainstorm", autoStopped: "paused", phaseStartedAt: null });
    // convex-test's clock moves on by a millisecond per call.
    expect(Math.abs(paused.pausedRemainingSec! - (8 * 60 - 69 * 60))).toBeLessThanOrEqual(1);
  });

  test("a new idea counts as activity", async () => {
    const { t, slug, at } = await setup();
    vi.setSystemTime(T0 + 30 * MIN);
    await t.mutation(api.ideas.add, { slug, participantId: ALICE, column: "keep", text: "Late idea", initials: "" });
    expect((await at(80)).autoStopped).toBeNull();
    expect((await at(91)).autoStopped).toBe("paused");
  });

  test("resuming lifts the automatic pause; the idle time starts again", async () => {
    const { t, slug, at, get } = await setup();
    await at(69);
    await t.mutation(api.phase.resume, { slug, from: "brainstorm" });
    expect(await get()).toMatchObject({ autoStopped: null, phaseStartedAt: expect.any(Number), pausedRemainingSec: null });
    // Still deep in overtime, but someone just acted.
    expect((await at(100)).autoStopped).toBeNull();
  });

  test("finishes a retro after a day without activity", async () => {
    const { at } = await setup();
    expect((await at(24 * 60 - 1)).state).toBe("brainstorm");
    expect(await at(24 * 60 + 1)).toMatchObject({ state: "finished", autoStopped: "finished", pausedRemainingSec: null });
  });

  test("leaves retros alone that have not started", async () => {
    const t = newTest(modules);
    const slug = await seedRetro(t);
    vi.setSystemTime(T0 + 30 * 24 * 60 * MIN);
    await t.mutation(internal.autoStop.run, {});
    expect((await t.query(api.retros.getBySlug, { slug }))!.state).toBe("not_started");
  });

  test("going back from an automatically finished retro reopens it", async () => {
    const { t, slug, at, get } = await setup();
    await at(24 * 60 + 1);
    await t.mutation(api.phase.back, { slug, from: "finished" });
    expect(await get()).toMatchObject({ state: "discuss", autoStopped: null });
  });
});
