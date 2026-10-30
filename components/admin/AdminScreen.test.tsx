import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { adminDeleteRetro, adminLogin, adminLogout, adminSaveAgenda, adminSaveSettings, isAdmin } from "@/app/actions/admin";
import { loadRecent, rememberRetro } from "@/lib/recentRetros";
import { AdminScreen } from "./AdminScreen";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/app/actions/admin", () => ({
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  adminSaveAgenda: vi.fn(),
  adminDeleteRetro: vi.fn(),
  adminSaveSettings: vi.fn(),
  isAdmin: vi.fn(),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const retro = {
  slug: "k7f3q9xa",
  name: "Sprint 42 Retro",
  lengthMin: 30,
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
  agenda: { intro: 4, brainstorm: 8, vote: 5, discuss: 13 },
  adminControlsPhases: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useQuery).mockReturnValue(retro);
  vi.mocked(isAdmin).mockResolvedValue(false);
});

describe("AdminScreen login", () => {
  test("asks for the password and logs in", async () => {
    const user = userEvent.setup();
    vi.mocked(adminLogin).mockResolvedValue({ ok: true });
    render(<AdminScreen slug="k7f3q9xa" />);
    expect(await screen.findByText("Admin area")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(adminLogin).toHaveBeenCalledWith("k7f3q9xa", "secret1");
    expect(await screen.findByText("Agenda times")).toBeInTheDocument();
  });

  test("shows the server's error and clears the field", async () => {
    const user = userEvent.setup();
    vi.mocked(adminLogin).mockResolvedValue({ ok: false, error: "Wrong password. 4 attempts left." });
    render(<AdminScreen slug="k7f3q9xa" />);
    await user.type(await screen.findByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong password. 4 attempts left.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  test("treats a failing session check as logged out", async () => {
    vi.mocked(isAdmin).mockRejectedValue(new Error("offline"));
    render(<AdminScreen slug="k7f3q9xa" />);
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
  });

  test("loading and not-found states", async () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { rerender } = render(<AdminScreen slug="k7f3q9xa" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    vi.mocked(useQuery).mockReturnValue(null);
    rerender(<AdminScreen slug="k7f3q9xa" />);
    expect(await screen.findByText("Retro not found")).toBeInTheDocument();
  });
});

describe("AdminScreen panel", () => {
  beforeEach(() => vi.mocked(isAdmin).mockResolvedValue(true));

  test("edits agenda times with a live total and warning", async () => {
    const user = userEvent.setup();
    vi.mocked(adminSaveAgenda).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Each phase needs between 1 and 120 whole minutes." });
    render(<AdminScreen slug="k7f3q9xa" />);
    expect(await screen.findByText("30 min of 30 min")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Discuss"));
    await user.type(screen.getByLabelText("Discuss"), "20");
    expect(screen.getByText("37 min of 30 min")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("7 min longer");

    await user.click(screen.getByRole("button", { name: "Save times" }));
    expect(adminSaveAgenda).toHaveBeenCalledWith("k7f3q9xa", { intro: 4, brainstorm: 8, vote: 5, discuss: 20 });
    expect(toast.success).toHaveBeenCalledWith("Agenda times saved · updated for everyone");

    await user.clear(screen.getByLabelText("Vote"));
    await user.clear(screen.getByLabelText("Discuss"));
    await user.type(screen.getByLabelText("Discuss"), "10");
    expect(screen.getByText("22 min of 30 min")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("8 min shorter");
    await user.click(screen.getByRole("button", { name: "Save times" }));
    expect(toast.error).toHaveBeenCalledWith("Each phase needs between 1 and 120 whole minutes.");

    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(screen.getByText("30 min of 30 min")).toBeInTheDocument();
  });

  test("deletes the retro only after typing its exact name", async () => {
    const user = userEvent.setup();
    rememberRetro("k7f3q9xa");
    vi.mocked(adminDeleteRetro).mockResolvedValueOnce({ ok: false, error: "Your admin session has expired. Please log in again." }).mockResolvedValueOnce({ ok: true });
    render(<AdminScreen slug="k7f3q9xa" />);
    const button = await screen.findByRole("button", { name: "Delete permanently" });
    await user.type(screen.getByLabelText("Retro name to confirm"), "sprint 42 retro");
    expect(button).toBeDisabled();
    await user.clear(screen.getByLabelText("Retro name to confirm"));
    await user.type(screen.getByLabelText("Retro name to confirm"), "Sprint 42 Retro");
    await user.click(button);
    expect(toast.error).toHaveBeenCalledWith("Your admin session has expired. Please log in again.");
    await user.click(button);
    expect(adminDeleteRetro).toHaveBeenLastCalledWith("k7f3q9xa", "Sprint 42 Retro");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(loadRecent()).toEqual([]);
  });

  test("switches who controls the phases", async () => {
    const user = userEvent.setup();
    vi.mocked(adminSaveSettings).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Your admin session has expired. Please log in again." });
    render(<AdminScreen slug="k7f3q9xa" />);
    const box = await screen.findByRole("checkbox", { name: "Only the admin can switch phases" });
    expect(box).toBeChecked();
    await user.click(box);
    expect(adminSaveSettings).toHaveBeenCalledWith("k7f3q9xa", false);
    expect(toast.success).toHaveBeenCalledWith("Everyone can switch phases now");
    await user.click(box);
    expect(toast.error).toHaveBeenCalledWith("Your admin session has expired. Please log in again.");
  });

  test("logs out", async () => {
    const user = userEvent.setup();
    render(<AdminScreen slug="k7f3q9xa" />);
    await user.click(await screen.findByRole("button", { name: "Log out" }));
    expect(adminLogout).toHaveBeenCalledWith("k7f3q9xa");
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
  });

  test("lists only enabled phases", async () => {
    vi.mocked(useQuery).mockReturnValue({ ...retro, enabledPhases: ["brainstorm", "discuss"], agenda: { intro: 0, brainstorm: 12, vote: 0, discuss: 18 } });
    render(<AdminScreen slug="k7f3q9xa" />);
    expect(await screen.findByLabelText("Brainstorm")).toBeInTheDocument();
    expect(screen.queryByLabelText("Vote")).not.toBeInTheDocument();
  });
});
