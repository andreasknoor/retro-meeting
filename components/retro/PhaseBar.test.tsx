import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAction, useMutation } from "convex/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AgendaCard } from "./AgendaCard";
import { PhaseBar } from "./PhaseBar";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useMutation: vi.fn(), useAction: vi.fn() }));

const NOW = 1_000_000;
const mutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.mocked(useMutation).mockReturnValue(mutate as never);
  vi.mocked(useAction).mockReturnValue(vi.fn().mockResolvedValue(NOW) as never);
});

const base: Retro = {
  slug: "k7f3q9xa",
  name: "Retro",
  subtitle: null,
  date: "2026-10-28",
  lengthMin: 30,
  facilitator: "Alex",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
  agenda: { intro: 4, brainstorm: 8, vote: 5, discuss: 13 },
  state: "not_started",
  phaseStartedAt: null,
  phaseDurationSec: null,
};

const timer = () => screen.getByRole("timer");

describe("PhaseBar", () => {
  test("before the start: shows the first phase's length and offers to start it", () => {
    render(<PhaseBar retro={base} />);
    expect(timer()).toHaveTextContent("Not started04:00");
    expect(screen.getByRole("button", { name: "Start Intro & Pulse" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "+1 min" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "End early" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  test("running: counts down and sends the seen state with each control", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar retro={{ ...base, state: "brainstorm", phaseStartedAt: NOW - 95_000, phaseDurationSec: 480 }} />);
    expect(timer()).toHaveTextContent("Brainstorm06:25");
    expect(within(screen.getByRole("list", { name: "Phases" })).getByText("Brainstorm").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );

    await user.click(screen.getByRole("button", { name: "Start Vote" }));
    expect(mutate).toHaveBeenLastCalledWith({ slug: "k7f3q9xa", from: "brainstorm" });
    await user.click(screen.getByRole("button", { name: "+1 min" }));
    expect(mutate).toHaveBeenLastCalledWith({ slug: "k7f3q9xa", from: "brainstorm" });
    await user.click(screen.getByRole("button", { name: "End early" }));
    expect(mutate).toHaveBeenCalledTimes(3);
  });

  test("overtime is shown with a plus sign", () => {
    render(<PhaseBar retro={{ ...base, state: "vote", phaseStartedAt: NOW - 383_000, phaseDurationSec: 300 }} />);
    expect(timer()).toHaveTextContent("+01:23");
  });

  test("ended early: shows Ended and still offers the next phase", () => {
    render(<PhaseBar retro={{ ...base, state: "discuss" }} />);
    expect(timer()).toHaveTextContent("DiscussEnded");
    expect(screen.getByRole("button", { name: "Finish retro" })).toBeInTheDocument();
  });

  test("finished: no start button", () => {
    render(<PhaseBar retro={{ ...base, state: "finished" }} />);
    expect(timer()).toHaveTextContent("Finished00:00");
    expect(screen.queryByRole("button", { name: /Start|Finish/ })).not.toBeInTheDocument();
  });

  test("reset asks inline before resetting", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar retro={{ ...base, state: "vote" }} />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Reset phases? Data is kept.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(mutate).toHaveBeenCalledWith({ slug: "k7f3q9xa" });
  });

  test("leaves disabled phases out of the stepper", () => {
    render(<PhaseBar retro={{ ...base, enabledPhases: ["brainstorm", "discuss"] }} />);
    expect(within(screen.getByRole("list", { name: "Phases" })).queryByText("Vote")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Brainstorm" })).toBeInTheDocument();
  });
});

describe("AgendaCard", () => {
  test("lists phases with start offsets and marks the current one", () => {
    render(<AgendaCard retro={{ ...base, state: "vote" }} />);
    expect(screen.getByText("30-minute agenda")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "0:00Intro & Pulse4 min",
      "0:04Brainstorm8 min",
      "0:12Vote5 min",
      "0:17Discuss13 min",
    ]);
    expect(rows[2]).toHaveAttribute("aria-current", "step");
  });
});
