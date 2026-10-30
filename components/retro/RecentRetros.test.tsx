import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rememberRetro } from "@/lib/recentRetros";
import { RecentRetros } from "./RecentRetros";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("RecentRetros", () => {
  test("shows an empty state and skips the query when nothing is stored", async () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<RecentRetros />);
    expect(await screen.findByText(/No retros on this device yet/)).toBeInTheDocument();
    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), "skip");
  });

  test("lists stored retros with links", async () => {
    rememberRetro("k7f3q9xa");
    vi.mocked(useQuery).mockReturnValue([
      { slug: "k7f3q9xa", name: "Sprint 42 Retro", date: "2026-10-28", facilitator: "Alex" },
    ]);
    render(<RecentRetros />);
    const link = await screen.findByRole("link", { name: /Sprint 42 Retro/ });
    expect(link).toHaveAttribute("href", "/r/k7f3q9xa");
    expect(link).toHaveTextContent("28 Oct 2026 · Alex");
    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), { slugs: ["k7f3q9xa"] });
  });

  test("shows the empty state when all stored retros were deleted", async () => {
    rememberRetro("k7f3q9xa");
    vi.mocked(useQuery).mockReturnValue([]);
    render(<RecentRetros />);
    expect(await screen.findByText(/No retros on this device yet/)).toBeInTheDocument();
  });

  test("shows loading while the query runs", async () => {
    rememberRetro("k7f3q9xa");
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<RecentRetros />);
    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });
});
