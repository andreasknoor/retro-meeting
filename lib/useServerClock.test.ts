import { act, renderHook, waitFor } from "@testing-library/react";
import { useAction } from "convex/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useServerNow } from "./useServerClock";

vi.mock("convex/react", () => ({ useAction: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(10_000);
});
afterEach(() => vi.useRealTimers());

test("adds the measured server offset to the local clock", async () => {
  const fetchNow = vi.fn().mockResolvedValue(70_000);
  vi.mocked(useAction).mockReturnValue(fetchNow as never);
  const { result } = renderHook(() => useServerNow());
  await waitFor(() => expect(result.current).toBeGreaterThanOrEqual(69_000));
  expect(result.current).toBeLessThan(71_000);
});

test("ticks forward", async () => {
  vi.mocked(useAction).mockReturnValue(vi.fn().mockResolvedValue(10_000) as never);
  const { result } = renderHook(() => useServerNow(100));
  const first = result.current;
  await act(async () => {
    vi.advanceTimersByTime(1_000);
  });
  expect(result.current).toBeGreaterThan(first);
});

test("falls back to the local clock when the server is unreachable", async () => {
  vi.mocked(useAction).mockReturnValue(vi.fn().mockRejectedValue(new Error("offline")) as never);
  const { result } = renderHook(() => useServerNow());
  await act(async () => {});
  expect(Math.abs(result.current - Date.now())).toBeLessThan(500);
});

test("ignores a late answer after unmount", async () => {
  let resolve!: (v: number) => void;
  vi.mocked(useAction).mockReturnValue(vi.fn(() => new Promise<number>((r) => (resolve = r))) as never);
  const { unmount } = renderHook(() => useServerNow());
  unmount();
  await act(async () => resolve(99_999));
});
