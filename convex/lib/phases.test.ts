import { describe, expect, test } from "vitest";
import type { Phase } from "./agenda";
import { canMakeActionFromIdea, hasReached, nextState, phaseIndex, previousPhase, schedule } from "./phases";

const ALL: Phase[] = ["intro", "brainstorm", "vote", "discuss"];
const NO_VOTE: Phase[] = ["intro", "brainstorm", "discuss"];

describe("phaseIndex / nextState", () => {
  test("walks through all enabled phases", () => {
    expect(phaseIndex("not_started", ALL)).toBe(-1);
    expect(phaseIndex("vote", ALL)).toBe(2);
    expect(phaseIndex("finished", ALL)).toBe(4);
    expect(nextState("not_started", ALL)).toBe("intro");
    expect(nextState("vote", ALL)).toBe("discuss");
    expect(nextState("discuss", ALL)).toBe("finished");
    expect(nextState("finished", ALL)).toBe("finished");
  });

  test("skips disabled phases", () => {
    expect(nextState("brainstorm", NO_VOTE)).toBe("discuss");
    expect(nextState("not_started", ["brainstorm"])).toBe("brainstorm");
  });
});

describe("hasReached", () => {
  test("is true for the current and earlier phases", () => {
    expect(hasReached("brainstorm", ALL, "vote")).toBe(false);
    expect(hasReached("vote", ALL, "vote")).toBe(true);
    expect(hasReached("finished", ALL, "vote")).toBe(true);
  });

  test("is false for a disabled phase", () => {
    expect(hasReached("finished", NO_VOTE, "vote")).toBe(false);
  });
});

describe("canMakeActionFromIdea", () => {
  test("only during Discuss", () => {
    expect(canMakeActionFromIdea("vote", ALL)).toBe(false);
    expect(canMakeActionFromIdea("discuss", ALL)).toBe(true);
    expect(canMakeActionFromIdea("finished", ALL)).toBe(false);
  });

  test("after the end when Discuss is disabled", () => {
    expect(canMakeActionFromIdea("vote", ["brainstorm", "vote"])).toBe(false);
    expect(canMakeActionFromIdea("finished", ["brainstorm", "vote"])).toBe(true);
  });
});

test("schedule adds start offsets", () => {
  expect(schedule(NO_VOTE, { intro: 4, brainstorm: 10, vote: 0, discuss: 16 })).toEqual([
    { phase: "intro", startMin: 0, minutes: 4 },
    { phase: "brainstorm", startMin: 4, minutes: 10 },
    { phase: "discuss", startMin: 14, minutes: 16 },
  ]);
});

describe("previousPhase", () => {
  test("steps back one enabled phase, from finished to the last one", () => {
    expect(previousPhase("vote", ALL)).toBe("brainstorm");
    expect(previousPhase("discuss", NO_VOTE)).toBe("brainstorm");
    expect(previousPhase("finished", ALL)).toBe("discuss");
  });

  test("there is nothing before the first phase", () => {
    expect(previousPhase("intro", ALL)).toBeNull();
    expect(previousPhase("not_started", ALL)).toBeNull();
  });
});
