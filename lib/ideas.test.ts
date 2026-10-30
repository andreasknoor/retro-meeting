import { afterEach, describe, expect, test, vi } from "vitest";
import { applyVoteToggle, loadInitials, saveInitials, sortIdeas, topIdea } from "./ideas";

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

describe("applyVoteToggle", () => {
  const ideas = [
    { id: "k1", column: "keep", voteCount: 2, votedByMe: true },
    { id: "k2", column: "keep", voteCount: 0, votedByMe: false },
    { id: "f1", column: "fix", voteCount: 1, votedByMe: true },
  ];
  const summary = (list: typeof ideas) => list.map((i) => `${i.id}:${i.voteCount}${i.votedByMe ? "*" : ""}`).join(" ");

  test("moves the vote within the column only", () => {
    expect(summary(applyVoteToggle(ideas, "k2"))).toBe("k1:1 k2:1* f1:1*");
  });

  test("takes the vote back", () => {
    expect(summary(applyVoteToggle(ideas, "k1"))).toBe("k1:1 k2:0 f1:1*");
  });

  test("casts a first vote", () => {
    expect(summary(applyVoteToggle([{ id: "t1", column: "try", voteCount: 0, votedByMe: false }], "t1"))).toBe("t1:1*");
  });

  test("ignores unknown ideas", () => {
    expect(applyVoteToggle(ideas, "nope")).toEqual(ideas);
  });
});
