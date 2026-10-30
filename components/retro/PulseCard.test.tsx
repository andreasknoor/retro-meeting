import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { summarize } from "@/convex/lib/pulse";
import { PulseCard } from "./PulseCard";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));

const answer = vi.fn();
let optimistic: (store: unknown, args: { score: number }) => void;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useMutation).mockReturnValue({
    withOptimisticUpdate: (fn: typeof optimistic) => {
      optimistic = fn;
      return answer;
    },
  } as never);
});

const retro = {
  slug: "k7f3q9xa",
  name: "Sprint 42 Retro",
  state: "intro",
} as Retro;

describe("PulseCard", () => {
  test("shows the question, average, count and distribution", () => {
    vi.mocked(useQuery).mockReturnValue(summarize([5, 4, 4, 3], null));
    render(<PulseCard retro={retro} participantId="me-000000" />);
    expect(screen.getByText("How well did Sprint 42 Retro work for you?")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText(/4 people have answered/)).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Results" })).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual(["5 Great1", "4 Good2", "3 Okay1", "2 Poor0", "1 Bad0"]);
    expect(screen.queryByText(/You answered/)).not.toBeInTheDocument();
  });

  test("highlights the own answer", () => {
    vi.mocked(useQuery).mockReturnValue(summarize([3], 3));
    render(<PulseCard retro={retro} participantId="me-000000" />);
    expect(screen.getByText("You answered 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3\s*Okay/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/1 person has answered/)).toBeInTheDocument();
  });

  test("sends the score and updates optimistically", async () => {
    const user = userEvent.setup();
    const current = summarize([5], null);
    vi.mocked(useQuery).mockReturnValue(current);
    render(<PulseCard retro={retro} participantId="me-000000" />);
    await user.click(screen.getByRole("button", { name: /4\s*Good/ }));
    expect(answer).toHaveBeenCalledWith({ slug: "k7f3q9xa", participantId: "me-000000", score: 4 });

    const store = { getQuery: vi.fn(() => current), setQuery: vi.fn() };
    optimistic(store, { score: 4 });
    expect(store.setQuery).toHaveBeenCalledWith(expect.anything(), expect.anything(), summarize([5, 4], 4));
    store.getQuery.mockReturnValue(undefined as never);
    optimistic(store, { score: 4 });
    expect(store.setQuery).toHaveBeenCalledTimes(1);
  });

  test("shows a dash before anyone answered or while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<PulseCard retro={{ ...retro, state: "brainstorm" }} participantId="me-000000" />);
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText(/0 people have answered/)).toBeInTheDocument();
  });
});
