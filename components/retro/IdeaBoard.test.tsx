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
const toggle = vi.fn();
const makeAction = vi.fn();
let optimisticAdd: (store: unknown, args: Record<string, string>) => void;
let optimisticVote: (store: unknown, args: Record<string, string>) => void;

const retro = {
  slug: "k7f3q9xa",
  state: "brainstorm",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
} as Retro;

const idea = (id: string, column: Idea["column"], text: string, extra: Partial<Idea> = {}): Idea =>
  ({
    id,
    column,
    text,
    initials: null,
    voteCount: 0,
    createdAt: Number(id.replace(/\D/g, "")),
    isMine: false,
    votedByMe: false,
    ...extra,
  }) as Idea;

const IDEAS = [
  idea("i1", "keep", "Short stand-ups", { initials: "AK", voteCount: 1 }),
  idea("i2", "keep", "Pairing", { voteCount: 4, votedByMe: true }),
  idea("i3", "fix", "Flaky tests", { isMine: true }),
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useQuery).mockReturnValue(IDEAS);
  vi.mocked(useMutation).mockImplementation(((ref: never) => {
    const name = getFunctionName(ref);
    if (name === "ideas:add")
      return {
        withOptimisticUpdate: (fn: typeof optimisticAdd) => {
          optimisticAdd = fn;
          return add;
        },
      };
    if (name === "votes:toggle")
      return {
        withOptimisticUpdate: (fn: typeof optimisticVote) => {
          optimisticVote = fn;
          return toggle;
        },
      };
    return remove;
  }) as never);
});

const column = (name: string) => screen.getByRole("region", { name });
const texts = (name: string) =>
  within(column(name))
    .queryAllByRole("listitem")
    .map((li) => li.querySelector("p")!.firstChild!.textContent);

describe("IdeaBoard", () => {
  test("says so when the list is cut off at the per-retro limit", () => {
    vi.mocked(useQuery).mockReturnValue(Array.from({ length: 300 }, (_, i) => idea(`i${i + 1}`, "keep", `Idea ${i}`)));
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("only the first 300 are shown");
  });

  test("says so when vote counts may be cut off", () => {
    vi.mocked(useQuery).mockReturnValue([idea("i1", "keep", "Busy", { voteCount: 2000 }), idea("i2", "fix", "Also", { voteCount: 1000 })]);
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("vote counts may be incomplete");
  });

  test("shows no such note for a normal board", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={vi.fn()} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test.each([
    ["brainstorm", true],
    ["vote", true],
    ["discuss", false],
  ] as const)("is highlighted in %s: %s", (state, highlighted) => {
    const { container } = render(<IdeaBoard retro={{ ...retro, state }} participantId="me-000000" onMakeAction={vi.fn()} />);
    expect(container.querySelector('[data-slot="card"]')!.classList.contains("ring-2")).toBe(highlighted);
  });

  test("shows ideas per column in creation order before voting", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    expect(texts("Keep")).toEqual(["Short stand-ups", "Pairing"]);
    expect(texts("Fix")).toEqual(["Flaky tests"]);
    expect(within(column("Try")).getByText("No ideas yet")).toBeInTheDocument();
    expect(within(column("Keep")).getByText("AK")).toBeInTheDocument();
    expect(screen.queryByText(/^Top in/)).not.toBeInTheDocument();
  });

  test("ranks by votes from the Vote phase on and marks the top idea", () => {
    render(<IdeaBoard retro={{ ...retro, state: "discuss" }} participantId="me-000000" onMakeAction={makeAction} />);
    expect(texts("Keep")).toEqual(["Pairing", "Short stand-ups"]);
    expect(within(column("Keep")).getByText("Top in Keep")).toBeInTheDocument();
    expect(within(column("Fix")).queryByText("Top in Fix")).not.toBeInTheDocument();
  });

  test("only the author sees Delete", async () => {
    const user = userEvent.setup();
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    expect(within(column("Keep")).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(remove).toHaveBeenCalledWith({ ideaId: "i3", participantId: "me-000000" });
    expect(toast).toHaveBeenCalledWith("Idea deleted");
  });

  test("reports a failed delete", async () => {
    const user = userEvent.setup();
    remove.mockRejectedValueOnce(new ConvexError("Only the author can delete this idea."));
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(toast.error).toHaveBeenCalledWith("Only the author can delete this idea.");
  });

  test("adds an idea with Enter, remembers the initials and clears the draft", async () => {
    const user = userEvent.setup();
    add.mockResolvedValue("new");
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
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
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    const box = screen.getByLabelText("New idea for Keep");
    await user.type(box, "Line 1{Shift>}{Enter}{/Shift}Line 2");
    expect(add).not.toHaveBeenCalled();
    expect(box).toHaveValue("Line 1\nLine 2");
  });

  test("keeps the draft and shows the error when adding fails", async () => {
    const user = userEvent.setup();
    add.mockRejectedValue(new ConvexError("The idea is empty."));
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
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
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    await user.type(screen.getByLabelText("New idea for Fix"), "Oops{Enter}");
    expect(toast.error).toHaveBeenCalledWith("Could not add the idea.");
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(toast.error).toHaveBeenCalledWith("Could not delete the idea.");
  });

  test("the optimistic update appends the idea at the end", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
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
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    expect(screen.getByRole("tab", { name: "Keep (2)" })).toHaveAttribute("aria-selected", "true");
    expect(column("Fix")).toHaveClass("max-md:hidden");
    await user.click(screen.getByRole("tab", { name: "Fix (1)" }));
    expect(column("Fix")).not.toHaveClass("max-md:hidden");
    expect(column("Keep")).toHaveClass("max-md:hidden");
  });

  test("renders nothing in the columns while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    expect(screen.queryByText("No ideas yet")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Keep (0)" })).toBeInTheDocument();
  });
});

describe("voting", () => {
  const voteButton = (col: string, n: number) => within(column(col)).getAllByRole("button", { name: /Vote/ })[n];

  test("before the Vote phase the buttons are disabled and counts hidden", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    expect(voteButton("Keep", 0)).toBeDisabled();
    expect(screen.queryByText(/\d votes?$/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Votes left")).toHaveClass("text-muted-foreground");
  });

  test("during the Vote phase: vote, see counts and votes left", async () => {
    const user = userEvent.setup();
    toggle.mockResolvedValue("cast");
    render(<IdeaBoard retro={{ ...retro, state: "vote" }} participantId="me-000000" onMakeAction={makeAction} />);
    expect(screen.getByLabelText("Votes left")).toHaveTextContent("2 of 3 votes left");
    expect(within(column("Keep")).getByText("4 votes")).toBeInTheDocument();
    expect(within(column("Keep")).getByText("1 vote")).toBeInTheDocument();
    expect(voteButton("Keep", 0)).toHaveTextContent("✓ Voted");
    expect(voteButton("Keep", 0)).toHaveAttribute("aria-pressed", "true");

    await user.click(voteButton("Fix", 0));
    expect(toggle).toHaveBeenCalledWith({ ideaId: "i3", participantId: "me-000000" });
    expect(toast).not.toHaveBeenCalled();
  });

  test("tells when a vote was moved and reports errors", async () => {
    const user = userEvent.setup();
    toggle.mockResolvedValueOnce("moved").mockRejectedValueOnce(new ConvexError("Voting is only possible during the Vote phase."));
    toggle.mockRejectedValueOnce(new Error("network"));
    render(<IdeaBoard retro={{ ...retro, state: "vote" }} participantId="me-000000" onMakeAction={makeAction} />);
    await user.click(voteButton("Keep", 1));
    expect(toast).toHaveBeenCalledWith("Vote moved");
    await user.click(voteButton("Keep", 1));
    expect(toast.error).toHaveBeenCalledWith("Voting is only possible during the Vote phase.");
    await user.click(voteButton("Keep", 1));
    expect(toast.error).toHaveBeenCalledWith("Could not vote.");
  });

  test("the optimistic update moves the vote", () => {
    render(<IdeaBoard retro={{ ...retro, state: "vote" }} participantId="me-000000" onMakeAction={makeAction} />);
    const store = { getQuery: vi.fn(() => IDEAS), setQuery: vi.fn() };
    optimisticVote(store, { ideaId: "i1", participantId: "me-000000" });
    const next = store.setQuery.mock.calls[0][2] as Idea[];
    expect(next.map((i) => [i.id, i.voteCount, i.votedByMe])).toEqual([
      ["i1", 2, true],
      ["i2", 3, false],
      ["i3", 0, false],
    ]);
    store.getQuery.mockReturnValue(undefined as never);
    optimisticVote(store, { ideaId: "i1", participantId: "me-000000" });
    expect(store.setQuery).toHaveBeenCalledTimes(1);
  });

  test("no voting UI when the Vote phase is disabled", () => {
    render(<IdeaBoard retro={{ ...retro, state: "discuss", enabledPhases: ["brainstorm", "discuss"] }} participantId="me-000000" onMakeAction={makeAction} />);
    expect(screen.queryByRole("button", { name: /Vote/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Votes left")).not.toBeInTheDocument();
    expect(texts("Keep")).toEqual(["Short stand-ups", "Pairing"]);
  });
});

describe("admin delete", () => {
  test("admins see Delete on every idea and the call goes through the admin path", async () => {
    const user = userEvent.setup();
    const onAdminDelete = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("Your admin session has expired. Please log in again.");
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} onAdminDelete={onAdminDelete} />);
    const keepDeletes = within(column("Keep")).getAllByRole("button", { name: "Delete" });
    expect(keepDeletes).toHaveLength(2);
    await user.click(keepDeletes[0]);
    expect(onAdminDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "i1" }));
    expect(remove).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Idea deleted");
    await user.click(keepDeletes[1]);
    expect(toast.error).toHaveBeenCalledWith("Your admin session has expired. Please log in again.");
    // Own ideas still use the participant path.
    await user.click(within(column("Fix")).getByRole("button", { name: "Delete" }));
    expect(remove).toHaveBeenCalledWith({ ideaId: "i3", participantId: "me-000000" });
  });
});

describe("make action", () => {
  test("is disabled outside Discuss", () => {
    render(<IdeaBoard retro={retro} participantId="me-000000" onMakeAction={makeAction} />);
    for (const b of screen.getAllByRole("button", { name: "Make action" })) expect(b).toBeDisabled();
  });

  test("hands the idea over during Discuss and shows the action badge", async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue([...IDEAS.slice(0, 2), { ...IDEAS[2], hasAction: true }]);
    render(<IdeaBoard retro={{ ...retro, state: "discuss" }} participantId="me-000000" onMakeAction={makeAction} />);
    await user.click(within(column("Keep")).getAllByRole("button", { name: "Make action" })[0]);
    expect(makeAction).toHaveBeenCalledWith(expect.objectContaining({ id: "i2", text: "Pairing" }));
    expect(within(column("Fix")).getByText("→ Action")).toBeInTheDocument();
  });
});

test("boardHint", () => {
  expect(boardHint("brainstorm", true, false)).toMatch(/Voting opens in the Vote phase/);
  expect(boardHint("brainstorm", false, false)).not.toMatch(/Voting/);
  expect(boardHint("vote", true, true)).toMatch(/Voting is open/);
  expect(boardHint("discuss", true, true)).toMatch(/Voting is closed.*can still be added, but they get no votes/);
  expect(boardHint("finished", true, true)).not.toMatch(/can still be added/);
  expect(boardHint("vote", true, true)).toMatch(/Ideas added now may miss the votes already cast/);
});
