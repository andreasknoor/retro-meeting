import { afterEach, describe, expect, test, vi } from "vitest";
import { forgetRetro, loadRecent, MAX_RECENT, rememberRetro, subscribeRecent } from "./recentRetros";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("recent retros", () => {
  test("starts empty", () => {
    expect(loadRecent()).toEqual([]);
  });

  test("puts the latest retro first without duplicates", () => {
    rememberRetro("aaaaaaaa");
    rememberRetro("bbbbbbbb");
    expect(rememberRetro("aaaaaaaa")).toEqual(["aaaaaaaa", "bbbbbbbb"]);
    expect(loadRecent()).toEqual(["aaaaaaaa", "bbbbbbbb"]);
  });

  test(`keeps at most ${MAX_RECENT} entries`, () => {
    for (let i = 0; i < MAX_RECENT + 5; i++) rememberRetro(`slug${String(i).padStart(4, "0")}`);
    expect(loadRecent()).toHaveLength(MAX_RECENT);
    expect(loadRecent()[0]).toBe(`slug${String(MAX_RECENT + 4).padStart(4, "0")}`);
  });

  test("forgets a retro", () => {
    rememberRetro("aaaaaaaa");
    rememberRetro("bbbbbbbb");
    expect(forgetRetro("aaaaaaaa")).toEqual(["bbbbbbbb"]);
  });

  test("ignores corrupt data", () => {
    localStorage.setItem("retro:recent", "{not json");
    expect(loadRecent()).toEqual([]);
    localStorage.setItem("retro:recent", JSON.stringify({ a: 1 }));
    expect(loadRecent()).toEqual([]);
    localStorage.setItem("retro:recent", JSON.stringify(["aaaaaaaa", 42]));
    expect(loadRecent()).toEqual(["aaaaaaaa"]);
  });

  test("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadRecent()).toEqual([]);
    expect(rememberRetro("aaaaaaaa")).toEqual(["aaaaaaaa"]);
    expect(forgetRetro("aaaaaaaa")).toEqual([]);
  });
});

test("notifies about changes from other tabs only for its own key", () => {
  const onChange = vi.fn();
  const unsubscribe = subscribeRecent(onChange);
  window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
  window.dispatchEvent(new StorageEvent("storage", { key: "retro:recent" }));
  expect(onChange).toHaveBeenCalledTimes(1);
  unsubscribe();
  window.dispatchEvent(new StorageEvent("storage", { key: "retro:recent" }));
  expect(onChange).toHaveBeenCalledTimes(1);
});
