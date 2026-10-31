import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { changeIcebreaker } from "@/app/actions/retro";
import { ICEBREAKERS } from "@/convex/lib/icebreakers";
import { IcebreakerCard } from "./IcebreakerCard";
import type { Retro } from "./types";

vi.mock("@/app/actions/retro", () => ({ changeIcebreaker: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const retro = { slug: "k7f3q9xa", state: "intro", icebreaker: ICEBREAKERS[0] } as Retro;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(changeIcebreaker).mockResolvedValue({ ok: true });
});

describe("IcebreakerCard", () => {
  test("shows the question before the start and during Intro only", () => {
    const { rerender, container } = render(<IcebreakerCard retro={{ ...retro, state: "not_started" }} canControl={false} />);
    expect(screen.getByText(ICEBREAKERS[0])).toBeInTheDocument();
    rerender(<IcebreakerCard retro={retro} canControl={false} />);
    expect(screen.getByText(ICEBREAKERS[0])).toBeInTheDocument();
    rerender(<IcebreakerCard retro={{ ...retro, state: "brainstorm" }} canControl={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<IcebreakerCard retro={{ ...retro, icebreaker: null }} canControl={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("participants who can't switch phases can't change it", () => {
    render(<IcebreakerCard retro={retro} canControl={false} />);
    expect(screen.queryByRole("button", { name: "Another question" })).not.toBeInTheDocument();
  });

  test("draws another question from the catalog", async () => {
    const user = userEvent.setup();
    render(<IcebreakerCard retro={retro} canControl />);
    await user.click(screen.getByRole("button", { name: "Another question" }));
    const [slug, question] = vi.mocked(changeIcebreaker).mock.calls[0];
    expect(slug).toBe("k7f3q9xa");
    expect(ICEBREAKERS).toContain(question);
    expect(question).not.toBe(ICEBREAKERS[0]);
  });

  test("uses an own question and reports errors", async () => {
    const user = userEvent.setup();
    vi.mocked(changeIcebreaker).mockResolvedValueOnce({ ok: false, error: "The check-in is over." });
    render(<IcebreakerCard retro={retro} canControl />);
    await user.click(screen.getByRole("button", { name: "Write your own" }));
    expect(screen.getByRole("button", { name: "Use this question" })).toBeDisabled();
    await user.type(screen.getByLabelText("Your question"), "Coffee or tea?");
    await user.click(screen.getByRole("button", { name: "Use this question" }));
    expect(changeIcebreaker).toHaveBeenCalledWith("k7f3q9xa", "Coffee or tea?");
    expect(toast.error).toHaveBeenCalledWith("The check-in is over.");
    await user.click(screen.getByRole("button", { name: "Use this question" }));
    expect(screen.queryByLabelText("Your question")).not.toBeInTheDocument();
  });
});
