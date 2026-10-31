import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { changeIcebreaker } from "@/app/actions/retro";
import { ICEBREAKERS } from "@/convex/lib/icebreakers";
import { CheckinCard } from "./CheckinCard";
import type { Retro } from "./types";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("@/app/actions/retro", () => ({ changeIcebreaker: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const answer = vi.fn();
const retro = { slug: "k7f3q9xa", state: "checkin" } as Retro;
const QUESTION = ICEBREAKERS[0];
const hidden = { question: QUESTION, total: 2, mine: null, revealed: false, answers: [] };
const revealed = {
  question: QUESTION,
  total: 2,
  mine: { text: "Tea", initials: "AK" },
  revealed: true,
  answers: [
    { text: "Coffee", initials: null, isMine: false },
    { text: "Tea", initials: "AK", isMine: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  answer.mockResolvedValue(null);
  vi.mocked(useMutation).mockReturnValue(answer as never);
  vi.mocked(useQuery).mockReturnValue(hidden);
  vi.mocked(changeIcebreaker).mockResolvedValue({ ok: true });
});

describe("CheckinCard", () => {
  test("before the start: the question, but no answers yet", () => {
    render(<CheckinCard retro={{ ...retro, state: "not_started" }} participantId="me-000000" canControl={false} />);
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByText("Answers open when the Check-in phase starts.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your answer")).not.toBeInTheDocument();
  });

  test("during the phase: highlighted, answer with initials; others hidden until you answer", async () => {
    const user = userEvent.setup();
    const { container } = render(<CheckinCard retro={retro} participantId="me-000000" canControl={false} />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-2");
    expect(screen.getByText(/2 people have answered\. The answers show once you have answered too\./)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your answer"), "Tea");
    await user.type(screen.getByLabelText("Initials for your answer"), "ak");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(answer).toHaveBeenCalledWith({ slug: "k7f3q9xa", participantId: "me-000000", text: "Tea", initials: "AK" });
  });

  test("shows all answers once you have answered, and lets you change yours", () => {
    vi.mocked(useQuery).mockReturnValue(revealed);
    render(<CheckinCard retro={retro} participantId="me-000000" canControl={false} />);
    expect(screen.getByRole("list", { name: "Check-in answers" })).toHaveTextContent("CoffeeTeaAK");
    expect(screen.getByLabelText("Your answer")).toHaveValue("Tea");
    expect(screen.getByRole("button", { name: "Change answer" })).toBeDisabled();
  });

  test("reports a refused answer", async () => {
    const user = userEvent.setup();
    answer.mockRejectedValueOnce(new ConvexError("Answers are possible during the Check-in phase."));
    render(<CheckinCard retro={retro} participantId="me-000000" canControl={false} />);
    await user.type(screen.getByLabelText("Your answer"), "Tea{Enter}");
    expect(toast.error).toHaveBeenCalledWith("Answers are possible during the Check-in phase.");
  });

  test("gone after the phase; nothing without a question", () => {
    const { container, rerender } = render(<CheckinCard retro={{ ...retro, state: "intro" }} participantId="me-000000" canControl />);
    expect(container).toBeEmptyDOMElement();
    vi.mocked(useQuery).mockReturnValue({ ...hidden, question: null });
    rerender(<CheckinCard retro={retro} participantId="me-000000" canControl />);
    expect(container).toBeEmptyDOMElement();
  });

  test("whoever controls the phases can draw another question or write their own", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CheckinCard retro={retro} participantId="me-000000" canControl={false} />);
    expect(screen.queryByRole("button", { name: "Another question" })).not.toBeInTheDocument();
    rerender(<CheckinCard retro={retro} participantId="me-000000" canControl />);
    await user.click(screen.getByRole("button", { name: "Another question" }));
    const drawn = vi.mocked(changeIcebreaker).mock.calls[0][1];
    expect(ICEBREAKERS).toContain(drawn);
    expect(drawn).not.toBe(QUESTION);
    await user.click(screen.getByRole("button", { name: "Write your own" }));
    await user.type(screen.getByLabelText("Your question"), "Coffee or tea?");
    await user.click(screen.getByRole("button", { name: "Use this question" }));
    expect(changeIcebreaker).toHaveBeenLastCalledWith("k7f3q9xa", "Coffee or tea?");
  });
});
