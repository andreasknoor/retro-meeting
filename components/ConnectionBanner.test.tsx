import { render, screen } from "@testing-library/react";
import { useConvexConnectionState } from "convex/react";
import { expect, test, vi } from "vitest";
import { ConnectionBanner } from "./ConnectionBanner";

vi.mock("convex/react", () => ({ useConvexConnectionState: vi.fn() }));

const state = (isWebSocketConnected: boolean, hasEverConnected: boolean) =>
  vi.mocked(useConvexConnectionState).mockReturnValue({ isWebSocketConnected, hasEverConnected } as never);

test("hidden while connected and before the first connection", () => {
  state(true, true);
  const { rerender } = render(<ConnectionBanner />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  state(false, false);
  rerender(<ConnectionBanner />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("shown when an established connection drops", () => {
  state(false, true);
  render(<ConnectionBanner />);
  expect(screen.getByRole("status")).toHaveTextContent("Connection lost. Reconnecting…");
});
