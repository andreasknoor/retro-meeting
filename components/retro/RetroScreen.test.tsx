import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadRecent, rememberRetro } from "@/lib/recentRetros";
import { RetroScreen } from "./RetroScreen";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const retro = {
  slug: "k7f3q9xa",
  name: "Sprint 42 Retro",
  subtitle: "Keep, fix, try",
  date: "2026-10-28",
  lengthMin: 30,
  facilitator: "Alex",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
  agenda: { intro: 4, brainstorm: 8, vote: 5, discuss: 13 },
  state: "not_started",
  phaseStartedAt: null,
  phaseDurationSec: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("RetroScreen", () => {
  test("shows a loading state", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.getByText("Loading retro…")).toBeInTheDocument();
  });

  test("shows the header with master data and remembers the retro", async () => {
    vi.mocked(useQuery).mockReturnValue(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.getByRole("heading", { name: "Sprint 42 Retro" })).toBeInTheDocument();
    expect(screen.getByText("Keep, fix, try")).toBeInTheDocument();
    expect(screen.getByText("Wed 28 Oct")).toBeInTheDocument();
    expect(screen.getByText("30 minutes")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    await waitFor(() => expect(loadRecent()).toEqual(["k7f3q9xa"]));
  });

  test("hides the subtitle when there is none", () => {
    vi.mocked(useQuery).mockReturnValue({ ...retro, subtitle: null });
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.queryByText("Keep, fix, try")).not.toBeInTheDocument();
  });

  test("shows not-found and forgets the retro", async () => {
    rememberRetro("k7f3q9xa");
    vi.mocked(useQuery).mockReturnValue(null);
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.getByText("Retro not found")).toBeInTheDocument();
    await waitFor(() => expect(loadRecent()).toEqual([]));
  });

  test("copies the share link", async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    await user.click(screen.getByRole("button", { name: /Copy link/ }));
    await expect(navigator.clipboard.readText()).resolves.toBe(`${window.location.origin}/r/k7f3q9xa`);
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  test("shows the link when the clipboard is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    vi.mocked(useQuery).mockReturnValue(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    await user.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(`${window.location.origin}/r/k7f3q9xa`, expect.anything()),
    );
  });
});
