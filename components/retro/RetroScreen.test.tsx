import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { isAdmin } from "@/app/actions/admin";
import { loadRecent, rememberRetro } from "@/lib/recentRetros";
import { RetroScreen } from "./RetroScreen";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: () => vi.fn() })),
  useAction: vi.fn(() => vi.fn().mockResolvedValue(Date.now())),
}));
vi.mock("@convex-dev/presence/react", () => ({ default: vi.fn(() => undefined) }));
vi.mock("@/app/actions/admin", () => ({ isAdmin: vi.fn(async () => false), adminDeleteIdea: vi.fn(), adminLogin: vi.fn() }));
vi.mock("@/app/actions/retro", () => ({ switchPhase: vi.fn() }));
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
  adminControlsPhases: true,
};

function mockRetro(value: unknown) {
  // getBySlug returns the retro; other queries (e.g. the pulse summary) stay loading.
  vi.mocked(useQuery).mockImplementation(((ref: never) =>
    getFunctionName(ref) === "retros:getBySlug" ? value : undefined) as never);
}

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

  test("a finished retro says what is read-only and who can reopen it", () => {
    mockRetro({ ...retro, state: "finished" });
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.getByText(/ideas and the pulse check are read-only/)).toHaveTextContent("The admin can reopen it with Back.");
  });

  test("shows the pulse check only when the intro phase is enabled", () => {
    mockRetro(retro);
    const { rerender } = render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.getByText("Pulse check")).toBeInTheDocument();
    mockRetro({ ...retro, enabledPhases: ["brainstorm"] });
    rerender(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.queryByText("Pulse check")).not.toBeInTheDocument();
  });

  test("shows the header with master data and remembers the retro", async () => {
    mockRetro(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(screen.getByRole("heading", { name: "Sprint 42 Retro" })).toBeInTheDocument();
    expect(screen.getByText("Keep, fix, try")).toBeInTheDocument();
    expect(screen.getByText("Wed 28 Oct")).toBeInTheDocument();
    expect(screen.getByText("30 minutes")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    await waitFor(() => expect(loadRecent()).toEqual(["k7f3q9xa"]));
  });

  test("hides the subtitle when there is none", () => {
    mockRetro({ ...retro, subtitle: null });
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

  test("announces phase changes, including ones made by others", () => {
    mockRetro(retro);
    const { rerender } = render(<RetroScreen slug="k7f3q9xa" />);
    expect(toast).not.toHaveBeenCalled();
    for (const [state, message] of [
      ["vote", "Phase changed to Vote"],
      ["finished", "Retro finished"],
      ["not_started", "Retro reset · ideas and actions kept"],
    ]) {
      mockRetro({ ...retro, state });
      rerender(<RetroScreen slug="k7f3q9xa" />);
      expect(toast).toHaveBeenLastCalledWith(message);
    }
  });

  test("shows the admin badge and link for admins", async () => {
    vi.mocked(isAdmin).mockResolvedValueOnce(true);
    mockRetro(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    expect(await screen.findByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open admin area" })).toHaveAttribute("href", "/r/k7f3q9xa/admin");
    expect(screen.getByRole("button", { name: "Start Intro & Pulse" })).toBeInTheDocument();
  });

  test("shows the retro link as a QR code and closes it again", async () => {
    const user = userEvent.setup();
    mockRetro(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    await user.click(screen.getByRole("button", { name: /QR code/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(`${window.location.origin}/r/k7f3q9xa`);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("copies the share link", async () => {
    const user = userEvent.setup();
    mockRetro(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    await user.click(screen.getByRole("button", { name: /Copy link/ }));
    await expect(navigator.clipboard.readText()).resolves.toBe(`${window.location.origin}/r/k7f3q9xa`);
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  test("shows the link when the clipboard is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    mockRetro(retro);
    render(<RetroScreen slug="k7f3q9xa" />);
    await user.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(`${window.location.origin}/r/k7f3q9xa`, expect.anything()),
    );
  });
});
