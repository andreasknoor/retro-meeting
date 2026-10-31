import { act, renderHook } from "@testing-library/react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HEARTBEAT_MS, useOnlineCount } from "./useOnlineCount";

vi.mock("convex/react", () => ({ useConvex: vi.fn(), useMutation: vi.fn(), useQuery: vi.fn() }));

const heartbeat = vi.fn();
const disconnect = vi.fn();
const sendBeacon = vi.fn();
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  heartbeat.mockResolvedValue({ roomToken: "room-1", sessionToken: "session-1" });
  disconnect.mockResolvedValue(null);
  vi.mocked(useConvex).mockReturnValue({ url: "https://example.convex.cloud" } as never);
  vi.mocked(useMutation).mockImplementation(((ref: never) => (getFunctionName(ref) === "presence:heartbeat" ? heartbeat : disconnect)) as never);
  vi.mocked(useQuery).mockImplementation(((_: never, args: unknown) =>
    args === "skip" ? undefined : [{ online: true }, { online: true }, { online: false }]) as never);
  Object.assign(navigator, { sendBeacon });
});
afterEach(() => {
  vi.useRealTimers();
  setHidden(false);
});

describe("useOnlineCount", () => {
  test("beats right away and every 20 s, and counts only people online", async () => {
    const { result } = renderHook(() => useOnlineCount("k7f3q9xa", "alice-0000"));
    await act(async () => {});
    expect(heartbeat).toHaveBeenCalledWith(expect.objectContaining({ roomId: "k7f3q9xa", userId: "alice-0000", interval: HEARTBEAT_MS }));
    expect(result.current).toBe(2);
    await act(async () => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  test("a hidden tab stays online and beats at once when it is shown again", async () => {
    renderHook(() => useOnlineCount("k7f3q9xa", "alice-0000"));
    await act(async () => {});
    await act(async () => setHidden(true));
    expect(disconnect).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(heartbeat).toHaveBeenCalledTimes(2);
    await act(async () => setHidden(false));
    expect(heartbeat).toHaveBeenCalledTimes(3);
  });

  test("leaves when the page closes or the component goes away", async () => {
    const { unmount } = renderHook(() => useOnlineCount("k7f3q9xa", "alice-0000"));
    await act(async () => {});
    window.dispatchEvent(new Event("beforeunload"));
    expect(sendBeacon).toHaveBeenCalledWith("https://example.convex.cloud/api/mutation", expect.any(Blob));
    unmount();
    expect(disconnect).toHaveBeenCalledWith({ sessionToken: "session-1" });
  });

  test("unknown until the first heartbeat answered", () => {
    heartbeat.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useOnlineCount("k7f3q9xa", "alice-0000"));
    expect(result.current).toBeUndefined();
  });
});
