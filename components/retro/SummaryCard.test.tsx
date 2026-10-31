import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SummaryCard } from "./SummaryCard";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const retro = {
  slug: "k7f3q9xa",
  name: "Sprint 42 Retro",
  subtitle: null,
  date: "2026-10-28",
  facilitator: "Alex",
  state: "finished",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
} as unknown as Retro;

const data: Record<string, unknown> = {
  "ideas:list": [
    { id: "i1", column: "keep", text: "Pairing", voteCount: 3, createdAt: 1 },
    { id: "i2", column: "keep", text: "Short stand-ups", voteCount: 1, createdAt: 2 },
  ],
  "pulse:summary": { counts: [0, 0, 1, 1, 0], total: 2, average: 3.5, mine: null, revealed: true },
  "actions:list": [{ id: "a1", text: "Book a room", owner: "Sam", dueDate: "", done: true, idea: null }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQuery).mockImplementation(((ref: never, args: unknown) => (args === "skip" ? undefined : data[getFunctionName(ref)])) as never);
});

describe("SummaryCard", () => {
  test("shows pulse, top ideas and actions with status", () => {
    render(<SummaryCard retro={retro} participantId="me-000000" />);
    expect(screen.getByLabelText("Pulse result")).toHaveTextContent("Average 3.5 from 2 answers");
    expect(screen.getByLabelText("Top ideas")).toHaveTextContent("Keep: Pairing (3) · Short stand-ups (1)");
    expect(screen.getByText(/Book a room — Sam/)).toHaveClass("line-through");
  });

  test("copies the summary as Markdown", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<SummaryCard retro={retro} participantId="me-000000" />);
    await user.click(screen.getByRole("button", { name: "Copy as Markdown" }));
    expect(writeText.mock.calls[0][0]).toMatch(/^# Sprint 42 Retro\n[\s\S]*- \[x\] Book a room — Sam\n$/);
    expect(toast.success).toHaveBeenCalledWith("Summary copied as Markdown");
  });

  test("downloads a .md file", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<SummaryCard retro={retro} participantId="me-000000" />);
    await user.click(screen.getByRole("button", { name: "Download .md" }));
    expect(click).toHaveBeenCalled();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("2026-10-28-sprint-42-retro.md");
  });

  test("renders nothing while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    const { container } = render(<SummaryCard retro={retro} participantId="me-000000" />);
    expect(container).toBeEmptyDOMElement();
  });
});
