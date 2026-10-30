import { describe, expect, test } from "vitest";
import { calcAgenda, LENGTH_PRESETS, orderPhases, PHASES, type Phase } from "./agenda";

const ALL = [...PHASES];
const total = (a: Record<Phase, number>) => Object.values(a).reduce((s, n) => s + n, 0);

describe("calcAgenda", () => {
  test("30 minutes with all phases is the template", () => {
    expect(calcAgenda(30, ALL)).toEqual({ intro: 4, brainstorm: 8, vote: 5, discuss: 13 });
  });

  test.each(LENGTH_PRESETS)("%i minutes always add up exactly", (len) => {
    expect(total(calcAgenda(len, ALL))).toBe(len);
  });

  test("scales proportionally for 60 minutes", () => {
    expect(calcAgenda(60, ALL)).toEqual({ intro: 8, brainstorm: 16, vote: 10, discuss: 26 });
  });

  test("redistributes the time of disabled phases", () => {
    const a = calcAgenda(30, ["brainstorm", "vote", "discuss"]);
    expect(a.intro).toBe(0);
    expect(total(a)).toBe(30);
    expect(a.brainstorm).toBeGreaterThan(8);
  });

  test("puts the remainder on the last phase when Discuss is disabled", () => {
    const a = calcAgenda(45, ["intro", "brainstorm"]);
    expect(a.vote).toBe(0);
    expect(a.discuss).toBe(0);
    expect(total(a)).toBe(45);
  });

  test("returns zeros when nothing is enabled", () => {
    expect(total(calcAgenda(30, []))).toBe(0);
  });
});

describe("orderPhases", () => {
  test("sorts into canonical order and drops duplicates", () => {
    expect(orderPhases(["discuss", "brainstorm", "discuss", "intro"])).toEqual([
      "intro",
      "brainstorm",
      "discuss",
    ]);
  });
});
