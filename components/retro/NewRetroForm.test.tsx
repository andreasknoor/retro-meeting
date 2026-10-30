import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { todayIso } from "@/lib/format";
import { loadRecent } from "@/lib/recentRetros";
import { NewRetroForm } from "./NewRetroForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("convex/react", () => ({ useAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const create = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useAction).mockReturnValue(create as never);
});

async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name *"), "Sprint 42 Retro");
  await user.type(screen.getByLabelText("Facilitator *"), "Alex");
  await user.type(screen.getByLabelText(/Admin password/), "secret1");
  await user.type(screen.getByLabelText("Repeat password *"), "secret1");
  return user;
}

describe("NewRetroForm", () => {
  test("shows the calculated agenda and updates it with length and phases", async () => {
    const user = userEvent.setup();
    render(<NewRetroForm />);
    const agenda = screen.getByRole("list", { name: "Agenda preview" });
    expect(within(agenda).getByText("Discuss · 13 min")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "60 min" }));
    expect(within(agenda).getByText("Discuss · 26 min")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Vote"));
    expect(within(agenda).queryByText(/^Vote/)).not.toBeInTheDocument();
  });

  test("defaults the date to today", () => {
    render(<NewRetroForm />);
    expect(screen.getByLabelText("Date *")).toHaveValue(todayIso());
  });

  test("Brainstorm cannot be switched off", () => {
    render(<NewRetroForm />);
    expect(screen.getByLabelText(/Brainstorm/)).toBeDisabled();
  });

  test("lists all validation problems and does not submit", async () => {
    const user = userEvent.setup();
    render(<NewRetroForm />);
    await user.click(screen.getByRole("button", { name: "Create retro" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Name is required.");
    expect(alert).toHaveTextContent("Facilitator is required.");
    expect(alert).toHaveTextContent("Password needs at least 6 characters.");
    expect(create).not.toHaveBeenCalled();
  });

  test("rejects mismatching passwords", async () => {
    render(<NewRetroForm />);
    const user = await fillValidForm();
    await user.type(screen.getByLabelText("Repeat password *"), "x");
    await user.click(screen.getByRole("button", { name: "Create retro" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(create).not.toHaveBeenCalled();
  });

  test("creates the retro, remembers it and opens it", async () => {
    create.mockResolvedValue({ slug: "k7f3q9xa" });
    render(<NewRetroForm />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "45 min" }));
    await user.click(screen.getByRole("button", { name: "Create retro" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/r/k7f3q9xa"));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sprint 42 Retro",
        facilitator: "Alex",
        lengthMin: 45,
        enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
        password: "secret1",
      }),
    );
    expect(loadRecent()).toEqual(["k7f3q9xa"]);
  });

  test("shows the server's error message", async () => {
    create.mockRejectedValue(new ConvexError("Date is invalid."));
    render(<NewRetroForm />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create retro" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Date is invalid.");
    expect(screen.getByRole("button", { name: "Create retro" })).toBeEnabled();
  });

  test("shows a generic message for unexpected errors", async () => {
    create.mockRejectedValue(new Error("network"));
    render(<NewRetroForm />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create retro" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
  });
});
