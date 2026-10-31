import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { adminLogin } from "@/app/actions/admin";
import { switchPhase } from "@/app/actions/retro";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AgendaCard } from "./AgendaCard";
import { PhaseBar } from "./PhaseBar";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useAction: vi.fn() }));
vi.mock("@/app/actions/retro", () => ({ switchPhase: vi.fn() }));
vi.mock("@/app/actions/admin", () => ({ adminLogin: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const NOW = 1_000_000;
const mutate = vi.mocked(switchPhase);
const onAdminLogin = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  mutate.mockResolvedValue({ ok: true });
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
  pausedRemainingSec: null,
  adminControlsPhases: false,
};

const timer = () => screen.getByRole("timer");

describe("PhaseBar", () => {
  test("before the start: shows the first phase's length and offers to start it", () => {
    render(<PhaseBar hasVotes={false} retro={base} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(timer()).toHaveTextContent("Not started04:00");
    expect(screen.getByRole("button", { name: "Start Intro & Pulse" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "+1 min" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  test("running: counts down and sends the seen state with each control", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "brainstorm", phaseStartedAt: NOW - 95_000, phaseDurationSec: 480 }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(timer()).toHaveTextContent("Brainstorm06:25");
    expect(within(screen.getByRole("list", { name: "Phases" })).getByText("Brainstorm").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );

    await user.click(screen.getByRole("button", { name: "Start Vote" }));
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "startNext", "brainstorm", undefined);
    await user.click(screen.getByRole("button", { name: "+1 min" }));
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "extend", "brainstorm", undefined);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "pause", "brainstorm", undefined);
  });

  test("Back returns to the previous phase and is disabled at the start", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<PhaseBar hasVotes={false} retro={base} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    rerender(<PhaseBar hasVotes={false} retro={{ ...base, state: "intro" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    rerender(<PhaseBar hasVotes={false} retro={{ ...base, state: "discuss" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: "Back to Vote" }));
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "back", "discuss", undefined);
    rerender(<PhaseBar hasVotes={false} retro={{ ...base, state: "finished" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(screen.getByRole("button", { name: "Back to Discuss & Act" })).toBeEnabled();
  });

  test("warns before going back past Vote when there are votes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar retro={{ ...base, state: "vote" }} hasVotes isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: "Back to Brainstorm" }));
    const dialog = screen.getByRole("alertdialog", { name: "Confirm going back" });
    expect(dialog).toHaveTextContent("Going back to Brainstorm deletes all votes.");
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Brainstorm" }));
    await user.click(screen.getByRole("button", { name: "Delete votes & go back" }));
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "back", "vote", { discardVotes: true });
  });

  test("no warning without votes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "vote" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: "Back to Brainstorm" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "back", "vote", undefined);
  });

  test("overtime is shown with a plus sign", () => {
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "vote", phaseStartedAt: NOW - 383_000, phaseDurationSec: 300 }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(timer()).toHaveTextContent("+01:23");
  });

  test("paused: shows the remaining time, offers Resume, +1 min and the next phase", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "discuss", pausedRemainingSec: 192 }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(timer()).toHaveTextContent("Discuss & Act · Paused03:12");
    expect(screen.getByRole("button", { name: "Finish retro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+1 min" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(mutate).toHaveBeenLastCalledWith("k7f3q9xa", "resume", "discuss", undefined);
  });

  test("a timer stopped by the old End early shows as paused at 00:00", () => {
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "discuss" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(timer()).toHaveTextContent("Discuss & Act · Paused00:00");
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
  });

  test("finished: no start button", () => {
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "finished" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(timer()).toHaveTextContent("Finished00:00");
    expect(screen.queryByRole("button", { name: /Start|Finish/ })).not.toBeInTheDocument();
  });

  test("reset asks inline before resetting", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar hasVotes={false} retro={{ ...base, state: "vote" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Reset phases? Data is kept.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(mutate).toHaveBeenCalledWith("k7f3q9xa", "reset", "vote", undefined);
  });

  test("reset warns that votes will be deleted when there are any", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar hasVotes retro={{ ...base, state: "discuss" }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("alertdialog", { name: "Confirm reset" })).toHaveTextContent(
      "Reset deletes all votes. Ideas, pulse answers and actions stay.",
    );
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(mutate).toHaveBeenCalledWith("k7f3q9xa", "reset", "discuss", { discardVotes: true });
  });

  test("leaves disabled phases out of the stepper", () => {
    render(<PhaseBar hasVotes={false} retro={{ ...base, enabledPhases: ["brainstorm", "discuss"] }} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(within(screen.getByRole("list", { name: "Phases" })).queryByText("Vote")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Brainstorm" })).toBeInTheDocument();
  });
});

describe("PhaseBar with admin-only control", () => {
  const locked = { ...base, adminControlsPhases: true };

  test("participants see a hint instead of the controls", () => {
    render(<PhaseBar hasVotes={false} retro={locked} isAdmin={false} onAdminLogin={onAdminLogin} />);
    expect(screen.getByText("Only the admin can switch phases.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start/ })).not.toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("Not started");
  });

  test("the admin sees the controls", () => {
    render(<PhaseBar hasVotes={false} retro={locked} isAdmin onAdminLogin={onAdminLogin} />);
    expect(screen.getByRole("button", { name: "Start Intro & Pulse" })).toBeInTheDocument();
  });

  test("inline login unlocks the controls", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(adminLogin).mockResolvedValueOnce({ ok: false, error: "Wrong password. 4 attempts left." }).mockResolvedValueOnce({ ok: true });
    render(<PhaseBar hasVotes={false} retro={locked} isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: /Log in to control/ }));
    const field = screen.getByLabelText("Admin password");
    expect(field).toHaveFocus();
    await user.type(field, "nope{Enter}");
    expect(toast.error).toHaveBeenCalledWith("Wrong password. 4 attempts left.");
    expect(onAdminLogin).not.toHaveBeenCalled();
    await user.type(field, "secret1{Enter}");
    expect(adminLogin).toHaveBeenLastCalledWith("k7f3q9xa", "secret1");
    expect(onAdminLogin).toHaveBeenCalled();
  });

  test("the login can be cancelled", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PhaseBar hasVotes={false} retro={locked} isAdmin={false} onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: /Log in to control/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Only the admin can switch phases.")).toBeInTheDocument();
  });

  test("shows the server's refusal", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mutate.mockResolvedValueOnce({ ok: false, error: "Only the admin can switch phases." });
    render(<PhaseBar hasVotes={false} retro={locked} isAdmin onAdminLogin={onAdminLogin} />);
    await user.click(screen.getByRole("button", { name: "Start Intro & Pulse" }));
    expect(toast.error).toHaveBeenCalledWith("Only the admin can switch phases.");
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
      "0:17Discuss & Act13 min",
    ]);
    expect(rows[2]).toHaveAttribute("aria-current", "step");
  });
});
