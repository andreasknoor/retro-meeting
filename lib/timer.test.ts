import { describe, expect, test } from "vitest";
import { clockOffset, formatClock, formatOffset, remainingSec } from "./timer";

describe("remainingSec", () => {
  test("counts down and goes negative in overtime", () => {
    expect(remainingSec(0, 300, 0)).toBe(300);
    expect(remainingSec(0, 300, 61_500)).toBe(239);
    expect(remainingSec(0, 300, 300_000)).toBe(0);
    expect(remainingSec(0, 300, 383_000)).toBe(-83);
  });
});

describe("formatClock", () => {
  test.each([
    [425, "07:05"],
    [0, "00:00"],
    [-83, "+01:23"],
    [3600, "60:00"],
  ])("%i → %s", (sec, text) => {
    expect(formatClock(sec)).toBe(text);
  });
});

test("formatOffset", () => {
  expect(formatOffset(4)).toBe("0:04");
  expect(formatOffset(75)).toBe("1:15");
});

test("clockOffset assumes the server answered halfway through the round trip", () => {
  expect(clockOffset(1000, 6000, 1200)).toBe(4900);
  expect(clockOffset(1000, 1100, 1200)).toBe(0);
});
