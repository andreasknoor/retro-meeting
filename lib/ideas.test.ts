import { afterEach, describe, expect, test, vi } from "vitest";
import { loadInitials, saveInitials, sortIdeas, topIdea } from "./ideas";

const a = { id: "a", voteCount: 1, createdAt: 1 };
const b = { id: "b", voteCount: 3, createdAt: 2 };
const c = { id: "c", voteCount: 3, createdAt: 3 };
const z = { id: "z", voteCount: 0, createdAt: 4 };

describe("sortIdeas", () => {
  test("keeps creation order before voting", () => {
    expect(sortIdeas([c, a, b], false).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  test("sorts by votes with creation order as tie-breaker", () => {
    expect(sortIdeas([a, c, z, b], true).map((i) => i.id)).toEqual(["b", "c", "a", "z"]);
  });
});

describe("topIdea", () => {
  test("is the first idea once voting started and it has votes", () => {
    expect(topIdea([b, a], true)).toBe(b);
    expect(topIdea([b, a], false)).toBeNull();
    expect(topIdea([z], true)).toBeNull();
    expect(topIdea([], true)).toBeNull();
  });
});

describe("initials preference", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("is remembered", () => {
    expect(loadInitials()).toBe("");
    saveInitials("AK");
    expect(loadInitials()).toBe("AK");
  });

  test("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    saveInitials("AK");
    expect(loadInitials()).toBe("");
  });
});
