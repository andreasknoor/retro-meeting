import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { describe, expect, test, vi } from "vitest";
import { HealthCheck } from "./HealthCheck";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

describe("HealthCheck", () => {
  test("shows a loading state until the backend answers", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<HealthCheck />);
    expect(screen.getByText("Connecting to backend…")).toBeInTheDocument();
  });

  test("shows success once the backend answers", () => {
    vi.mocked(useQuery).mockReturnValue({ ok: true });
    render(<HealthCheck />);
    expect(screen.getByText("✓ Backend connected")).toBeInTheDocument();
  });
});
