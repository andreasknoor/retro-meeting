/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedRetro } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const T0 = new Date("2026-10-28T10:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function setup(enabledPhases?: ("intro" | "brainstorm" | "vote" | "discuss")[]) {
  const t = convexTest(schema, modules);
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

describe("phase.extend / endEarly / reset", () => {
  test("+1 min extends the running phase", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.extend, { slug, from: "intro" });
    expect((await get()).phaseDurationSec).toBe(5 * 60);
  });

  test("+1 min does nothing without a running timer or with a stale state", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.extend, { slug, from: "not_started" });
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.extend, { slug, from: "vote" });
    await t.mutation(api.phase.endEarly, { slug, from: "intro" });
    await t.mutation(api.phase.extend, { slug, from: "intro" });
    expect((await get()).phaseDurationSec).toBeNull();
  });

  test("end early stops the timer but keeps the phase", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.endEarly, { slug, from: "intro" });
    expect(await get()).toMatchObject({ state: "intro", phaseStartedAt: null });
    await t.mutation(api.phase.endEarly, { slug, from: "intro" });
    await t.mutation(api.phase.startNext, { slug, from: "intro" });
    expect((await get()).state).toBe("brainstorm");
  });

  test("reset goes back to not started", async () => {
    const { t, slug, get } = await setup();
    await t.mutation(api.phase.startNext, { slug, from: "not_started" });
    await t.mutation(api.phase.reset, { slug });
    expect(await get()).toMatchObject({ state: "not_started", phaseStartedAt: null, phaseDurationSec: null });
  });
});

test("clock.now returns the server time", async () => {
  const t = convexTest(schema, modules);
  expect(await t.action(api.clock.now, {})).toBe(T0);
});
