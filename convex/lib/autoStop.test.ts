import { describe, expect, test } from "vitest";
import { AUTO_STOP, autoStopAction } from "./autoStop";

const MIN = 60 * 1000;
const now = new Date("2026-11-01T12:00:00Z").getTime();
// Brainstorm of 8 minutes started `startedMinAgo` minutes ago.
const running = (startedMinAgo: number) => ({ state: "brainstorm" as const, phaseStartedAt: now - startedMinAgo * MIN, phaseDurationSec: 8 * 60 });
const paused = { state: "brainstorm" as const };

describe("autoStopAction", () => {
  test("pauses a phase an hour into overtime after an hour without activity", () => {
    expect(autoStopAction(running(68), now - 68 * MIN, now)).toBe("paused");
  });

  test("leaves a phase alone that is not an hour into overtime yet", () => {
    expect(autoStopAction(running(67), now - 67 * MIN, now)).toBeNull();
  });

  test("leaves a long-overrunning phase alone while something happens", () => {
    expect(autoStopAction(running(120), now - 59 * MIN, now)).toBeNull();
  });

  test("finishes a retro after a day without activity, running or paused", () => {
    const dayAgo = now - AUTO_STOP.idleBeforeFinishMs;
    expect(autoStopAction(running(24 * 60), dayAgo, now)).toBe("finished");
    expect(autoStopAction(paused, dayAgo, now)).toBe("finished");
    expect(autoStopAction(paused, dayAgo + MIN, now)).toBeNull();
  });

  test("never touches retros that have not started or are finished", () => {
    const longAgo = now - 30 * 24 * 60 * MIN;
    expect(autoStopAction({ state: "not_started" }, longAgo, now)).toBeNull();
    expect(autoStopAction({ state: "finished" }, longAgo, now)).toBeNull();
  });
});
