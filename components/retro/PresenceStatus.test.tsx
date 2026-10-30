import usePresence from "@convex-dev/presence/react";
import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PresenceStatus } from "./PresenceStatus";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("@convex-dev/presence/react", () => ({ default: vi.fn() }));

const retro = { slug: "k7f3q9xa", state: "brainstorm" } as Retro;
const people = (online: number, offline = 0) => [
  ...Array.from({ length: online }, (_, i) => ({ userId: String(i), online: true, lastDisconnected: 0 })),
  ...Array.from({ length: offline }, (_, i) => ({ userId: `x${i}`, online: false, lastDisconnected: 1 })),
];

function mockQueries(values: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: never, args: unknown) =>
    args === "skip" ? undefined : values[getFunctionName(ref)]) as never);
}

beforeEach(() => vi.clearAllMocks());

describe("PresenceStatus", () => {
  test("shows nothing until presence has loaded", () => {
    vi.mocked(usePresence).mockReturnValue(undefined);
    mockQueries({});
    const { container } = render(<PresenceStatus retro={retro} participantId="alice-0000" />);
    expect(container).toBeEmptyDOMElement();
  });

  test("counts only people who are online", () => {
    vi.mocked(usePresence).mockReturnValue(people(3, 2));
    mockQueries({});
    render(<PresenceStatus retro={retro} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent(/^3 online$/);
  });

  test("shows how many have answered during Intro and voted during Vote", () => {
    vi.mocked(usePresence).mockReturnValue(people(4));
    mockQueries({ "pulse:summary": { total: 1 }, "votes:voterCount": 2 });
    const { rerender } = render(<PresenceStatus retro={{ ...retro, state: "intro" }} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent("4 online· 1 has answered");
    rerender(<PresenceStatus retro={{ ...retro, state: "vote" }} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent("4 online· 2 have voted");
  });
});
