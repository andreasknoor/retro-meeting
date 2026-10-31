import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { QrCodeDialog } from "./QrCodeDialog";

const LINK = "https://retro-meeting.andreasknoor.com/r/k7f3q9xa2b4c";

describe("QrCodeDialog", () => {
  test("renders the link as a QR code (SVG) with the link as text", async () => {
    render(<QrCodeDialog link={LINK} name="Sprint 42 Retro" onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "QR code for this retro" })).toHaveTextContent("Scan to open “Sprint 42 Retro”.");
    expect(screen.getByText(LINK)).toBeInTheDocument();
    const qr = screen.getByRole("img", { name: `QR code for ${LINK}` });
    await waitFor(() => expect(qr.querySelector("svg")).not.toBeNull());
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  test("closes with the button, Escape or a click outside, but not on a click inside", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<QrCodeDialog link={LINK} name="R" onClose={onClose} />);
    await user.click(screen.getByText(LINK));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
