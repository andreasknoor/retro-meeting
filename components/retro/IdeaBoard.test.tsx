import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { boardHint, IdeaBoard } from "./IdeaBoard";
import type { Idea, Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const add = vi.fn();
const remove = vi.fn();
let optimisticAdd: (store: unknown, args: Record<string, string>) => void;

const retro = {
  slug: "k7f3q9xa",
  state: "brainstorm",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
} as Retro;

const idea = (id: string, column: Idea["column"], text: string, extra: Partial<Idea> = {}): Idea =>
  ({ id, column, text, initials: null, voteCount: 0, createdAt: Number(id.replace(/\D/g, "")), isMine: false, ...extra }) as Idea;

const IDEAS = [
  idea("i1", "keep", "Short stand-ups", { initials: "AK", voteCount: 1 }),
  idea("i2", "keep", "Pairing", { voteCount: 4 }),
  idea("i3", "fix", "Flaky tests", { isMine: true }),
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useQuery).mockReturnValue(IDEAS);
  vi.mocked(useMutation).mockImplementation(((ref: never) =>
    getFunctionName(ref) === "ideas:add"
      ? {
          withOptimisticUpdate: (fn: typeof optimisticAdd) => {
            optimisticAdd = fn;
            return add;
          },
        }
      : Object.assign(remove, { withOptimisticUpdate: () => remove })) as never);
});

const column = (name: string) => screen.getByRole("region", { name });
const texts = (name: string) =>
  within(column(name))
    .queryAllByRole("listitem")
    .map((li) => li.querySelector("p")!.firstChild!.textContent);

describe("IdeaBoard", () => {
  test("shows ideas per column in creation order before voting", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    expect(texts("Keep")).toEqual(["Short stand-ups", "Pairing"]);
    expect(texts("Fix")).toEqual(["Flaky tests"]);
    expect(within(column("Try")).getByText("No ideas yet")).toBeInTheDocument();
    expect(within(column("Keep")).getByText("AK")).toBeInTheDocument();
    expect(screen.queryByText(/^Top in/)).not.toBeInTheDocument();
  });

  test("ranks by votes from the Vote phase on and marks the top idea", () => {
    render(<IdeaBoard retro={{ ...retro, state: "discuss" }} participantId="me-000000" />);
    expect(texts("Keep")).toEqual(["Pairing", "Short stand-ups"]);
    expect(within(column("Keep")).getByText("Top in Keep")).toBeInTheDocument();
    expect(within(column("Fix")).queryByText("Top in Fix")).not.toBeInTheDocument();
  });

  test("only the author sees Delete", async () => {
    const user = userEvent.setup();
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    expect(within(column("Keep")).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(remove).toHaveBeenCalledWith({ ideaId: "i3", participantId: "me-000000" });
    expect(toast).toHaveBeenCalledWith("Idea deleted");
  });

  test("reports a failed delete", async () => {
    const user = userEvent.setup();
    remove.mockRejectedValueOnce(new ConvexError("Only the author can delete this idea."));
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(toast.error).toHaveBeenCalledWith("Only the author can delete this idea.");
  });

  test("adds an idea with Enter, remembers the initials and clears the draft", async () => {
    const user = userEvent.setup();
    add.mockResolvedValue("new");
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    await user.type(screen.getByLabelText("Initials for Try"), "jk");
    const box = screen.getByLabelText("New idea for Try");
    await user.type(box, "Async stand-up{Enter}");
    expect(add).toHaveBeenCalledWith({
      slug: "k7f3q9xa",
      participantId: "me-000000",
      column: "try",
      text: "Async stand-up",
      initials: "JK",
    });
    expect(box).toHaveValue("");
    expect(localStorage.getItem("retro:initials")).toBe("JK");
    // Initials are shared by all columns.
    expect(screen.getByLabelText("Initials for Keep")).toHaveValue("JK");
  });

  test("Shift+Enter makes a new line instead of submitting", async () => {
    const user = userEvent.setup();
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    const box = screen.getByLabelText("New idea for Keep");
    await user.type(box, "Line 1{Shift>}{Enter}{/Shift}Line 2");
    expect(add).not.toHaveBeenCalled();
    expect(box).toHaveValue("Line 1\nLine 2");
  });

  test("keeps the draft and shows the error when adding fails", async () => {
    const user = userEvent.setup();
    add.mockRejectedValue(new ConvexError("The idea is empty."));
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    const box = screen.getByLabelText("New idea for Fix");
    await user.type(box, "Oops");
    await user.click(within(column("Fix")).getByRole("button", { name: "Add" }));
    expect(toast.error).toHaveBeenCalledWith("The idea is empty.");
    expect(box).toHaveValue("Oops");
  });

  test("a generic message for unexpected errors", async () => {
    const user = userEvent.setup();
    add.mockRejectedValue(new Error("network"));
    remove.mockRejectedValueOnce(new Error("network"));
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    await user.type(screen.getByLabelText("New idea for Fix"), "Oops{Enter}");
    expect(toast.error).toHaveBeenCalledWith("Could not add the idea.");
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(toast.error).toHaveBeenCalledWith("Could not delete the idea.");
  });

  test("the optimistic update appends the idea at the end", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    const store = { getQuery: vi.fn(() => IDEAS), setQuery: vi.fn() };
    optimisticAdd(store, { slug: "k7f3q9xa", participantId: "me-000000", column: "keep", text: " New ", initials: "" });
    const next = store.setQuery.mock.calls[0][2] as Idea[];
    expect(next).toHaveLength(4);
    expect(next[3]).toMatchObject({ column: "keep", text: "New", initials: null, isMine: true, voteCount: 0 });
    store.getQuery.mockReturnValue(undefined as never);
    optimisticAdd(store, { slug: "k7f3q9xa", participantId: "me-000000", column: "keep", text: "x", initials: "" });
    expect(store.setQuery).toHaveBeenCalledTimes(1);
  });

  test("mobile column tabs switch the visible column", async () => {
    const user = userEvent.setup();
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    expect(screen.getByRole("tab", { name: "Keep (2)" })).toHaveAttribute("aria-selected", "true");
    expect(column("Fix")).toHaveClass("max-md:hidden");
    await user.click(screen.getByRole("tab", { name: "Fix (1)" }));
    expect(column("Fix")).not.toHaveClass("max-md:hidden");
    expect(column("Keep")).toHaveClass("max-md:hidden");
  });

  test("renders nothing in the columns while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<IdeaBoard retro={retro} participantId="me-000000" />);
    expect(screen.queryByText("No ideas yet")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Keep (0)" })).toBeInTheDocument();
  });
});

test("boardHint", () => {
  expect(boardHint("brainstorm", true, false)).toMatch(/Voting opens in the Vote phase/);
  expect(boardHint("brainstorm", false, false)).not.toMatch(/Voting/);
  expect(boardHint("vote", true, true)).toMatch(/Voting is open/);
  expect(boardHint("discuss", true, true)).toMatch(/Voting is closed/);
});
