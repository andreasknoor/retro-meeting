import { describe, expect, test } from "vitest";
import { summaryFileName, summaryMarkdown, type SummaryInput } from "./summary";

const input: SummaryInput = {
  retro: { name: "Sprint 42 Retro", subtitle: "Keep, fix, try", date: "2026-10-28", facilitator: "Alex", votingOn: true },
  pulse: { counts: [0, 1, 0, 2, 1], total: 4, average: 3.8 },
  ideas: [
    { column: "keep", text: "Short stand-ups", voteCount: 1, createdAt: 1 },
    { column: "keep", text: "Pairing", voteCount: 3, createdAt: 2 },
    { column: "fix", text: "Flaky *tests*\nagain", voteCount: 0, createdAt: 3 },
  ],
  actions: [
    { text: "Quarantine flaky tests", owner: "Bob", dueDate: "2099-11-15", done: false, ideaColumn: "fix" },
    { text: "Book a room", owner: "Alex", dueDate: "", done: true, ideaColumn: null },
  ],
};

describe("summaryMarkdown", () => {
  test("lists header, pulse, ideas by votes and actions with status", () => {
    expect(summaryMarkdown(input)).toBe(`# Sprint 42 Retro

_Keep, fix, try_

28 Oct 2026 · Facilitator: Alex

## Pulse check

Average **3.8** from 4 answers

- 5 Great: 1
- 4 Good: 2
- 3 Okay: 0
- 2 Poor: 1
- 1 Bad: 0

## Ideas

### Keep

- Pairing (3 votes)
- Short stand-ups (1 vote)

### Fix

- Flaky \\*tests\\* again (0 votes)

### Try

No ideas.

## Actions

- [ ] Quarantine flaky tests (from Fix) — Bob, due 15.11.2099
- [x] Book a room — Alex
`);
  });

  test("without pulse check and voting, and with nothing added", () => {
    const md = summaryMarkdown({
      retro: { ...input.retro, subtitle: null, votingOn: false },
      pulse: null,
      ideas: [{ column: "try", text: "Mob # programming", voteCount: 0, createdAt: 1 }],
      actions: [],
    });
    expect(md).not.toContain("Pulse check");
    expect(md).toContain("- Mob \\# programming\n");
    expect(md).toContain("## Actions\n\nNo actions.\n");
  });
});

test("summaryFileName", () => {
  expect(summaryFileName("Sprint 42 Retro", "2026-10-28")).toBe("2026-10-28-sprint-42-retro.md");
  expect(summaryFileName("Größe & Ärger!", "2026-10-28")).toBe("2026-10-28-grosse-arger.md");
  expect(summaryFileName("???", "2026-10-28")).toBe("2026-10-28-retro.md");
});
