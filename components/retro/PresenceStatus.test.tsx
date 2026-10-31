import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useOnlineCount } from "@/lib/useOnlineCount";
import { PresenceStatus } from "./PresenceStatus";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("@/lib/useOnlineCount", () => ({ useOnlineCount: vi.fn() }));

const retro = { slug: "k7f3q9xa", state: "brainstorm" } as Retro;

function mockQueries(values: Record<string, unknown>) {
  vi.mocked(useQuery).mockImplementation(((ref: never, args: unknown) =>
    args === "skip" ? undefined : values[getFunctionName(ref)]) as never);
}

beforeEach(() => vi.clearAllMocks());

describe("PresenceStatus", () => {
  test("shows nothing until presence has loaded", () => {
    vi.mocked(useOnlineCount).mockReturnValue(undefined);
    mockQueries({});
    const { container } = render(<PresenceStatus retro={retro} participantId="alice-0000" />);
    expect(container).toBeEmptyDOMElement();
  });

  test("shows how many are online", () => {
    vi.mocked(useOnlineCount).mockReturnValue(3);
    mockQueries({});
    render(<PresenceStatus retro={retro} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent(/^3 online$/);
  });

  test("shows how many have answered during Intro and voted during Vote", () => {
    vi.mocked(useOnlineCount).mockReturnValue(4);
    mockQueries({ "pulse:summary": { total: 1 }, "votes:voterCount": 2 });
    const { rerender } = render(<PresenceStatus retro={{ ...retro, state: "intro" }} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent("4 online· 1 has answered");
    rerender(<PresenceStatus retro={{ ...retro, state: "vote" }} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent("4 online· 2 have voted");
  });

  test("shows how many have answered during Check-in", () => {
    vi.mocked(useOnlineCount).mockReturnValue(4);
    mockQueries({ "checkin:list": { total: 2 } });
    render(<PresenceStatus retro={{ ...retro, state: "checkin" }} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent("4 online· 2 have answered");
  });

  test("shows how many have added ideas during Brainstorm, without names", () => {
    vi.mocked(useOnlineCount).mockReturnValue(5);
    mockQueries({ "ideas:contributorCount": 3 });
    render(<PresenceStatus retro={retro} participantId="alice-0000" />);
    expect(screen.getByLabelText("Participants")).toHaveTextContent("5 online· 3 have added ideas");
  });
});
