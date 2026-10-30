import { describe, expect, test } from "vitest";
import { isScore, summarize, withAnswer } from "./pulse";

describe("summarize", () => {
  test("counts, total and a rounded average", () => {
    expect(summarize([5, 4, 4, 3], 4)).toEqual({ counts: [0, 0, 1, 2, 1], total: 4, average: 4, mine: 4 });
    expect(summarize([4, 4, 3], null).average).toBe(3.7);
  });

  test("no answers", () => {
    expect(summarize([], null)).toEqual({ counts: [0, 0, 0, 0, 0], total: 0, average: null, mine: null });
  });
});

describe("withAnswer", () => {
  test("adds a first answer", () => {
    expect(withAnswer(summarize([5], null), 3)).toEqual(summarize([5, 3], 3));
  });

  test("changing an answer does not double-count", () => {
    const before = summarize([5, 4, 2], 2);
    expect(withAnswer(before, 4)).toEqual(summarize([5, 4, 4], 4));
  });
});

test("isScore", () => {
  expect([0, 1, 3.5, 5, 6].map(isScore)).toEqual([false, true, false, true, false]);
});
