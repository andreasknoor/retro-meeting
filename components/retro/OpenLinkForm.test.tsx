import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { OpenLinkForm } from "./OpenLinkForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => vi.clearAllMocks());

test("opens a pasted retro link", async () => {
  const user = userEvent.setup();
  render(<OpenLinkForm />);
  await user.type(screen.getByLabelText("Have a link?"), "https://x.app/r/k7f3q9xa");
  await user.click(screen.getByRole("button", { name: "Open" }));
  expect(push).toHaveBeenCalledWith("/r/k7f3q9xa");
});

test("explains an invalid link and clears the message when typing", async () => {
  const user = userEvent.setup();
  render(<OpenLinkForm />);
  const input = screen.getByLabelText("Have a link?");
  await user.type(input, "not a link{Enter}");
  expect(screen.getByText("That doesn't look like a retro link.")).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
  await user.type(input, "x");
  expect(screen.queryByText("That doesn't look like a retro link.")).not.toBeInTheDocument();
});
