import { describe, expect, test } from "vitest";
import { ICEBREAKER_MAX_LENGTH, ICEBREAKERS, randomIcebreaker } from "./icebreakers";

describe("icebreakers", () => {
  test("a catalog of distinct, short questions", () => {
    expect(ICEBREAKERS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ICEBREAKERS).size).toBe(ICEBREAKERS.length);
    for (const q of ICEBREAKERS) expect(q.length).toBeLessThanOrEqual(ICEBREAKER_MAX_LENGTH);
  });

  test("never draws the current question again", () => {
    for (let i = 0; i < 50; i++) expect(randomIcebreaker(ICEBREAKERS[0], () => 0)).not.toBe(ICEBREAKERS[0]);
    expect(randomIcebreaker(null, () => 0)).toBe(ICEBREAKERS[0]);
    expect(randomIcebreaker(undefined, () => 0.9999)).toBe(ICEBREAKERS[ICEBREAKERS.length - 1]);
  });
});
