import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ActionItems } from "./ActionItems";
import type { ActionDraft, ActionItem, Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const mutations = { "actions:add": vi.fn(), "actions:update": vi.fn(), "actions:remove": vi.fn() };
const retro = { slug: "k7f3q9xa" } as Retro;
const ACTIONS = [
  { id: "a1", text: "Quarantine flaky tests", owner: "Alex", dueDate: "2026-11-05", createdAt: 1, idea: { id: "i3", column: "fix" } },
  { id: "a2", text: "Book a demo slot", owner: "Sam", dueDate: "2026-11-20", createdAt: 2, idea: null },
] as ActionItem[];
const draft: ActionDraft = { requestId: 1, ideaId: "i9" as ActionDraft["ideaId"], text: "Pre-reads before planning", column: "try" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQuery).mockReturnValue(ACTIONS);
  vi.mocked(useMutation).mockImplementation(((ref: never) => mutations[getFunctionName(ref) as keyof typeof mutations]) as never);
  mutations["actions:add"].mockResolvedValue("new");
  mutations["actions:update"].mockResolvedValue(null);
  mutations["actions:remove"].mockResolvedValue(null);
});

const form = () => screen.getByRole("form", { name: "New action" });

async function fill(user: ReturnType<typeof userEvent.setup>, text: string | null, owner: string, due: string) {
  if (text !== null) await user.type(within(form()).getByLabelText("Action"), text);
  await user.type(within(form()).getByLabelText("Owner"), owner);
  await user.type(within(form()).getByLabelText("Due date"), due);
}

describe("ActionItems", () => {
  test.each([
    ["discuss", true],
    ["vote", false],
    ["finished", false],
  ] as const)("is highlighted in %s: %s", (state, highlighted) => {
    const { container } = render(<ActionItems retro={{ ...retro, state }} draft={null} onClearDraft={vi.fn()} />);
    expect(container.querySelector('[data-slot="card"]')!.classList.contains("ring-2")).toBe(highlighted);
  });

  test("lists actions with owner, due date and origin", () => {
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    expect(screen.getByText("2 actions")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Actions" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Quarantine flaky testsfrom FixOwnerAlexDue05.11.2026");
    expect(rows[1]).toHaveTextContent("Book a demo slotOwnerSamDue20.11.2026");
  });

  test("shows the empty state", () => {
    vi.mocked(useQuery).mockReturnValue([]);
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    expect(screen.getByText("None yet")).toBeInTheDocument();
    expect(screen.getByText("No actions yet.")).toBeInTheDocument();
  });

  test("Add stays disabled until text, owner and due date are set", async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue([ACTIONS[0]]);
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    expect(screen.getByText("1 action")).toBeInTheDocument();
    const add = within(form()).getByRole("button", { name: "Add action" });
    expect(add).toBeDisabled();
    await fill(user, "Write a runbook", "Kim", "2026-12-01");
    expect(add).toBeEnabled();
    await user.click(add);
    expect(mutations["actions:add"]).toHaveBeenCalledWith({
      slug: "k7f3q9xa",
      text: "Write a runbook",
      owner: "Kim",
      dueDate: "2026-12-01",
      ideaId: undefined,
    });
    expect(within(form()).getByLabelText("Action")).toHaveValue("");
  });

  test("a draft from Make action pre-fills the text, focuses the owner and links the idea", async () => {
    const user = userEvent.setup();
    const onClearDraft = vi.fn();
    render(<ActionItems retro={retro} draft={draft} onClearDraft={onClearDraft} />);
    expect(within(form()).getByLabelText("Action")).toHaveValue("Pre-reads before planning");
    expect(within(form()).getByLabelText("Owner")).toHaveFocus();
    expect(screen.getByText(/From Try: “Pre-reads before planning”/)).toBeInTheDocument();

    await fill(user, null, "Alex", "2026-11-10");
    await user.click(within(form()).getByRole("button", { name: "Add action" }));
    expect(mutations["actions:add"]).toHaveBeenCalledWith(expect.objectContaining({ ideaId: "i9", owner: "Alex" }));
    expect(onClearDraft).toHaveBeenCalled();
  });

  test("the idea link can be removed and long idea texts are shortened", async () => {
    const user = userEvent.setup();
    const onClearDraft = vi.fn();
    render(<ActionItems retro={retro} draft={{ ...draft, text: "x".repeat(80) }} onClearDraft={onClearDraft} />);
    expect(screen.getByText(new RegExp(`“${"x".repeat(60)}…”`))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unlink idea" }));
    expect(onClearDraft).toHaveBeenCalled();
  });

  test("shows server errors when adding fails", async () => {
    const user = userEvent.setup();
    mutations["actions:add"].mockRejectedValueOnce(new ConvexError("Ideas can only become actions during the Discuss & Act phase."));
    mutations["actions:add"].mockRejectedValueOnce(new Error("network"));
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    await fill(user, "X", "Y", "2026-12-01");
    await user.click(within(form()).getByRole("button", { name: "Add action" }));
    expect(toast.error).toHaveBeenCalledWith("Ideas can only become actions during the Discuss & Act phase.");
    await user.click(within(form()).getByRole("button", { name: "Add action" }));
    expect(toast.error).toHaveBeenCalledWith("Could not add the action.");
  });

  test("edits an action inline", async () => {
    const user = userEvent.setup();
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    const edit = screen.getByRole("form", { name: "Edit action" });
    await user.clear(within(edit).getByLabelText("Owner"));
    await user.type(within(edit).getByLabelText("Owner"), "Kim");
    await user.click(within(edit).getByRole("button", { name: "Save" }));
    expect(mutations["actions:update"]).toHaveBeenCalledWith({
      actionId: "a2",
      text: "Book a demo slot",
      owner: "Kim",
      dueDate: "2026-11-20",
    });
    expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument();
  });

  test("keeps the editor open when saving fails, and can cancel", async () => {
    const user = userEvent.setup();
    mutations["actions:update"].mockRejectedValueOnce(new ConvexError("Every action needs an owner."));
    mutations["actions:update"].mockRejectedValueOnce(new Error("network"));
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const edit = screen.getByRole("form", { name: "Edit action" });
    await user.clear(within(edit).getByLabelText("Owner"));
    await user.click(within(edit).getByRole("button", { name: "Save" }));
    expect(toast.error).toHaveBeenCalledWith("Every action needs an owner.");
    await user.click(within(edit).getByRole("button", { name: "Save" }));
    expect(toast.error).toHaveBeenCalledWith("Could not save the action.");
    await user.click(within(edit).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Edit action" })).not.toBeInTheDocument();
  });

  test("deletes an action and reports failures", async () => {
    const user = userEvent.setup();
    render(<ActionItems retro={retro} draft={null} onClearDraft={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(mutations["actions:remove"]).toHaveBeenCalledWith({ actionId: "a1" });
    mutations["actions:remove"].mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not delete the action."));
  });
});
